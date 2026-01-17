import { ZcashRpcClient, ZcashTransaction, ZcashReceivedByAddress } from './ZcashRpcClient';
import { paymentRepository } from '../../database/repositories/PaymentRepository';
import { blockchainTransactionRepository } from '../../database/repositories/BlockchainTransactionRepository';
import { webhookEventRepository } from '../../database/repositories/WebhookEventRepository';
import { KeyManager } from '../wallet/KeyManager';
import { Payment } from '../../models/Payment';
import { BlockchainTransaction } from '../../models/BlockchainTransaction';
import { PaymentStatus, CryptoCurrency } from '../../types';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { decrypt } from '../../utils/crypto';

/**
 * Zcash Monitor Configuration
 */
export interface ZcashMonitorConfig {
  rpcUrl: string;
  rpcUser: string;
  rpcPass: string;
  confirmationThreshold: number;
  pollIntervalMs: number;
  addressCacheRefreshMs: number;
}

/**
 * Zcash address with decrypted view key (for shielded addresses)
 */
interface MonitoredShieldedAddress {
  address: string;
  viewKey: string;
  paymentId: string;
}

/**
 * Zcash Blockchain Monitor
 *
 * Monitors Zcash blockchain for incoming payments using:
 * - RPC polling (no ZMQ support in Zcash)
 * - Transparent address monitoring via listunspent/listreceivedbyaddress
 * - Shielded address monitoring via z_listreceivedbyaddress with view keys
 *
 * Flow:
 * 1. Poll blockchain every 15 seconds
 * 2. Check for new blocks
 * 3. Scan transparent addresses for new transactions
 * 4. Scan shielded addresses using imported view keys
 * 5. Update confirmations on new blocks
 * 6. Trigger state transitions at confirmation threshold
 */
export class ZcashMonitor {
  private rpcClient: ZcashRpcClient;
  private keyManager: KeyManager;
  private transparentAddressCache: Set<string> = new Set();
  private shieldedAddressCache: Map<string, MonitoredShieldedAddress> = new Map();
  private lastScannedBlockHeight: number = 0;
  private pollingInterval: NodeJS.Timer | null = null;
  private addressCacheRefreshInterval: NodeJS.Timer | null = null;
  private isRunning: boolean = false;
  private config: ZcashMonitorConfig;
  private viewKeysImported: Set<string> = new Set(); // Track which view keys are imported

  constructor(customConfig?: Partial<ZcashMonitorConfig>) {
    this.config = {
      rpcUrl: customConfig?.rpcUrl || config.zcashRpcUrl,
      rpcUser: customConfig?.rpcUser || config.zcashRpcUser,
      rpcPass: customConfig?.rpcPass || config.zcashRpcPass,
      confirmationThreshold: customConfig?.confirmationThreshold || config.zecConfirmationThreshold,
      pollIntervalMs: customConfig?.pollIntervalMs || config.zcashPollIntervalMs,
      addressCacheRefreshMs: customConfig?.addressCacheRefreshMs || 60000, // 60 seconds
    };

    // Initialize RPC client
    this.rpcClient = new ZcashRpcClient({
      url: this.config.rpcUrl,
      username: this.config.rpcUser,
      password: this.config.rpcPass,
    });

    // Initialize key manager for view key decryption
    this.keyManager = new KeyManager();

    logger.info('Zcash Monitor initialized', {
      rpcUrl: this.config.rpcUrl,
      confirmationThreshold: this.config.confirmationThreshold,
      pollIntervalMs: this.config.pollIntervalMs,
    });
  }

  /**
   * Initialize the monitor (test connections, setup)
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Zcash Monitor...');

    // Test RPC connection
    const rpcConnected = await this.rpcClient.testConnection();
    if (!rpcConnected) {
      throw new Error('Failed to connect to Zcash RPC');
    }

    // Get blockchain info
    const blockchainInfo = await this.rpcClient.getBlockchainInfo();
    logger.info('Zcash RPC connected', {
      chain: blockchainInfo.chain,
      blocks: blockchainInfo.blocks,
      headers: blockchainInfo.headers,
    });

    // Set initial last scanned block height
    this.lastScannedBlockHeight = blockchainInfo.blocks;

    // Initial address cache load
    await this.refreshAddressCache();

    // Ensure view keys are imported to zcashd
    await this.ensureViewKeysImported();

    logger.info('Zcash Monitor initialized successfully');
  }

  /**
   * Start the monitor
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Zcash Monitor already running');
      return;
    }

    logger.info('Starting Zcash Monitor...');

    // Start polling interval
    this.pollingInterval = setInterval(
      () => this.pollBlockchain(),
      this.config.pollIntervalMs
    );

    // Start address cache refresh interval
    this.addressCacheRefreshInterval = setInterval(
      () => this.refreshAddressCache(),
      this.config.addressCacheRefreshMs
    );

    this.isRunning = true;
    logger.info('Zcash Monitor started successfully');

    // Do initial poll
    await this.pollBlockchain();
  }

  /**
   * Stop the monitor
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Zcash Monitor not running');
      return;
    }

    logger.info('Stopping Zcash Monitor...');

    this.isRunning = false;

    // Stop intervals
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.addressCacheRefreshInterval) {
      clearInterval(this.addressCacheRefreshInterval);
      this.addressCacheRefreshInterval = null;
    }

    logger.info('Zcash Monitor stopped');
  }

  /**
   * Poll blockchain for new blocks and transactions
   */
  private async pollBlockchain(): Promise<void> {
    try {
      // Check for new blocks
      const currentHeight = await this.rpcClient.getBlockCount();

      if (currentHeight > this.lastScannedBlockHeight) {
        logger.info('New Zcash blocks detected', {
          from: this.lastScannedBlockHeight,
          to: currentHeight,
          newBlocks: currentHeight - this.lastScannedBlockHeight,
        });

        // Update confirmations for all unconfirmed transactions
        await this.updateAllConfirmations();

        this.lastScannedBlockHeight = currentHeight;
      }

      // Scan for new transactions
      await this.scanTransparentAddresses();
      await this.scanShieldedAddresses();
    } catch (error) {
      logger.error('Error polling Zcash blockchain', { error });
    }
  }

  /**
   * Scan transparent addresses for new transactions
   */
  private async scanTransparentAddresses(): Promise<void> {
    if (this.transparentAddressCache.size === 0) {
      return;
    }

    try {
      // Get all unspent outputs for monitored addresses
      const addresses = Array.from(this.transparentAddressCache);
      const utxos = await this.rpcClient.listUnspent(0, 9999999, addresses);

      for (const utxo of utxos) {
        // Check if this transaction has been processed
        const existingTx = await blockchainTransactionRepository.findByTxid(utxo.txid);
        if (existingTx) {
          continue; // Already processed
        }

        // Find associated payment
        const payment = await paymentRepository.findByCryptoAddress(utxo.address);
        if (!payment || payment.crypto_currency !== 'ZEC') {
          continue;
        }

        // Get full transaction details
        const tx = await this.rpcClient.getRawTransaction(utxo.txid, 1) as ZcashTransaction;
        await this.processZcashTransaction(tx, payment, false, null);

        logger.info('Transparent Zcash transaction processed', {
          txid: utxo.txid,
          paymentId: payment.id,
          amount: utxo.amount,
        });
      }
    } catch (error) {
      logger.error('Error scanning transparent addresses', { error });
    }
  }

  /**
   * Scan shielded addresses for new transactions
   */
  private async scanShieldedAddresses(): Promise<void> {
    if (this.shieldedAddressCache.size === 0) {
      return;
    }

    try {
      for (const [address, monitoredAddr] of this.shieldedAddressCache) {
        try {
          // Use z_listreceivedbyaddress to check for transactions
          const received = await this.rpcClient.z_listReceivedByAddress(address, 0);

          for (const entry of received) {
            // Check if this transaction has been processed
            const existingTx = await blockchainTransactionRepository.findByTxid(entry.txid);
            if (existingTx) {
              continue; // Already processed
            }

            // Find associated payment
            const payment = await paymentRepository.findById(monitoredAddr.paymentId);
            if (!payment) {
              logger.warn('Payment not found for shielded address', {
                address,
                paymentId: monitoredAddr.paymentId,
              });
              continue;
            }

            // Get full transaction details
            const tx = await this.rpcClient.getRawTransaction(entry.txid, 1) as ZcashTransaction;

            // Decode memo if present
            const memo = entry.memo ? this.rpcClient.decodeMemo(entry.memo) : null;

            await this.processZcashTransaction(tx, payment, true, memo);

            logger.info('Shielded Zcash transaction processed', {
              txid: entry.txid,
              paymentId: payment.id,
              amount: entry.amount,
              memo: memo,
            });
          }
        } catch (error) {
          logger.error('Error scanning shielded address', { address, error });
        }
      }
    } catch (error) {
      logger.error('Error scanning shielded addresses', { error });
    }
  }

  /**
   * Process a Zcash transaction
   */
  private async processZcashTransaction(
    tx: ZcashTransaction,
    payment: Payment,
    isShielded: boolean,
    memo: string | null
  ): Promise<void> {
    try {
      // Check if already processed
      const existingTx = await blockchainTransactionRepository.findByTxid(tx.txid);
      if (existingTx) {
        return;
      }

      // Determine amount (simplified - would need to calculate from outputs)
      let amount = '0';
      if (!isShielded) {
        // For transparent, find the output matching our address
        const matchedOutput = tx.vout.find(vout =>
          vout.scriptPubKey.addresses?.includes(payment.crypto_address)
        );
        if (matchedOutput) {
          amount = matchedOutput.value.toString();
        }
      } else {
        // For shielded, use payment's expected amount
        amount = payment.crypto_amount;
      }

      // Create blockchain transaction record
      const blockchainTx = await blockchainTransactionRepository.create({
        payment_id: payment.id,
        crypto_currency: 'ZEC' as CryptoCurrency,
        txid: tx.txid,
        from_address: null, // Can't determine sender easily
        to_address: payment.crypto_address,
        amount,
        confirmations: tx.confirmations || 0,
        block_height: undefined, // Will be set when confirmed
        block_hash: tx.blockhash || null,
        is_shielded: isShielded,
        memo: memo,
      });

      // Mark payment as detected
      await this.markPaymentDetected(payment, blockchainTx);

      logger.info('Zcash payment processed successfully', {
        txid: tx.txid,
        paymentId: payment.id,
        isShielded,
        amount,
      });
    } catch (error) {
      logger.error('Error processing Zcash transaction', { txid: tx.txid, error });
    }
  }

  /**
   * Mark payment as detected
   */
  private async markPaymentDetected(payment: Payment, tx: BlockchainTransaction): Promise<void> {
    try {
      // Update payment status to 'detected'
      await paymentRepository.markAsDetected(payment.id);

      // Link transaction to payment
      await paymentRepository.linkTransaction(payment.id, tx.txid);

      // Create webhook event
      await webhookEventRepository.create({
        merchant_id: payment.merchant_id,
        payment_id: payment.id,
        event_type: 'payment.detected',
        payload: {
          payment_id: payment.id,
          order_id: payment.order_id,
          txid: tx.txid,
          amount: tx.amount,
          confirmations: 0,
          is_shielded: tx.is_shielded,
          memo: tx.memo,
          detected_at: new Date().toISOString(),
        },
      });

      logger.info('Payment marked as detected', { paymentId: payment.id, txid: tx.txid });
    } catch (error) {
      logger.error('Error marking payment as detected', { paymentId: payment.id, error });
      throw error;
    }
  }

  /**
   * Update confirmations for all unconfirmed transactions
   */
  private async updateAllConfirmations(): Promise<void> {
    try {
      // Find all unconfirmed Zcash transactions
      const unconfirmedTxs = await blockchainTransactionRepository.findUnconfirmedTransactions(
        'ZEC' as CryptoCurrency,
        this.config.confirmationThreshold
      );

      if (unconfirmedTxs.length === 0) {
        return;
      }

      logger.debug('Updating confirmations for Zcash transactions', { count: unconfirmedTxs.length });

      for (const tx of unconfirmedTxs) {
        try {
          // Get current confirmations
          const confirmations = await this.rpcClient.getTransactionConfirmations(tx.txid);

          if (confirmations === -1) {
            logger.warn('Transaction not found in blockchain', { txid: tx.txid });
            continue;
          }

          // Skip if confirmations haven't changed
          if (confirmations === tx.confirmations) {
            continue;
          }

          // Get full transaction for block info
          let blockHash = tx.block_hash;
          if (confirmations > 0 && !blockHash) {
            const fullTx = await this.rpcClient.getRawTransaction(tx.txid, 1) as ZcashTransaction;
            blockHash = fullTx.blockhash || null;
          }

          // Update blockchain transaction confirmations
          await blockchainTransactionRepository.updateConfirmations(
            tx.txid,
            confirmations,
            blockHash || undefined
          );

          // Update payment confirmations
          if (tx.payment_id) {
            const payment = await paymentRepository.findById(tx.payment_id);
            if (payment) {
              await this.updatePaymentConfirmations(payment, confirmations);
            }
          }

          logger.debug('Updated transaction confirmations', {
            txid: tx.txid,
            confirmations,
          });
        } catch (error) {
          logger.error('Error updating transaction confirmations', { txid: tx.txid, error });
        }
      }
    } catch (error) {
      logger.error('Error updating all confirmations', { error });
    }
  }

  /**
   * Update payment confirmations
   */
  private async updatePaymentConfirmations(payment: Payment, confirmations: number): Promise<void> {
    try {
      // Update confirmation count
      const updatedPayment = await paymentRepository.update(payment.id, { confirmations });

      // Check if confirmation threshold reached
      if (confirmations >= this.config.confirmationThreshold && payment.status !== 'confirmed') {
        await this.markPaymentConfirmed(updatedPayment);
      }

      logger.debug('Payment confirmations updated', {
        paymentId: payment.id,
        confirmations,
        threshold: this.config.confirmationThreshold,
      });
    } catch (error) {
      logger.error('Error updating payment confirmations', { paymentId: payment.id, error });
      throw error;
    }
  }

  /**
   * Mark payment as confirmed
   */
  private async markPaymentConfirmed(payment: Payment): Promise<void> {
    try {
      // Update payment status to 'confirmed'
      await paymentRepository.markAsConfirmed(payment.id);

      // Create webhook event
      await webhookEventRepository.create({
        merchant_id: payment.merchant_id,
        payment_id: payment.id,
        event_type: 'payment.confirmed',
        payload: {
          payment_id: payment.id,
          order_id: payment.order_id,
          txid: payment.txid,
          amount: payment.crypto_amount,
          confirmations: payment.confirmations,
          confirmed_at: new Date().toISOString(),
        },
      });

      logger.info('Payment marked as confirmed', {
        paymentId: payment.id,
        txid: payment.txid,
        confirmations: payment.confirmations,
      });
    } catch (error) {
      logger.error('Error marking payment as confirmed', { paymentId: payment.id, error });
      throw error;
    }
  }

  /**
   * Refresh the cache of addresses to monitor
   */
  private async refreshAddressCache(): Promise<void> {
    try {
      // Find all pending and detected Zcash payments
      const payments = await paymentRepository.findByStatus(['pending', 'detected']);
      const zecPayments = payments.filter(p => p.crypto_currency === 'ZEC');

      // Separate transparent and shielded addresses
      const newTransparent = new Set<string>();
      const newShielded = new Map<string, MonitoredShieldedAddress>();

      for (const payment of zecPayments) {
        const address = payment.crypto_address;

        // Check if address is shielded (starts with 'z')
        if (address.startsWith('z')) {
          // TODO: Load view key from database and decrypt
          // For now, we'll skip shielded addresses without view keys
          newShielded.set(address, {
            address,
            viewKey: '', // Would load and decrypt from database
            paymentId: payment.id,
          });
        } else {
          newTransparent.add(address);
        }
      }

      // Log changes
      logger.info('Address cache refreshed', {
        transparentTotal: newTransparent.size,
        shieldedTotal: newShielded.size,
      });

      this.transparentAddressCache = newTransparent;
      this.shieldedAddressCache = newShielded;

      // Ensure view keys are imported for new shielded addresses
      if (newShielded.size > 0) {
        await this.ensureViewKeysImported();
      }
    } catch (error) {
      logger.error('Error refreshing address cache', { error });
    }
  }

  /**
   * Ensure all view keys are imported to zcashd
   */
  private async ensureViewKeysImported(): Promise<void> {
    for (const [address, monitoredAddr] of this.shieldedAddressCache) {
      if (this.viewKeysImported.has(address)) {
        continue; // Already imported
      }

      if (!monitoredAddr.viewKey) {
        logger.warn('No view key available for shielded address', { address });
        continue;
      }

      try {
        // Import view key to zcashd (rescan from current height)
        await this.rpcClient.z_importViewingKey(
          monitoredAddr.viewKey,
          'no', // Don't rescan (too expensive)
          this.lastScannedBlockHeight
        );

        this.viewKeysImported.add(address);
        logger.info('View key imported for shielded address', { address });
      } catch (error) {
        logger.error('Failed to import view key', { address, error });
      }
    }
  }

  /**
   * Get monitor status
   */
  getStatus(): {
    isRunning: boolean;
    transparentAddressCount: number;
    shieldedAddressCount: number;
    lastScannedBlockHeight: number;
    viewKeysImported: number;
  } {
    return {
      isRunning: this.isRunning,
      transparentAddressCount: this.transparentAddressCache.size,
      shieldedAddressCount: this.shieldedAddressCache.size,
      lastScannedBlockHeight: this.lastScannedBlockHeight,
      viewKeysImported: this.viewKeysImported.size,
    };
  }

  /**
   * Get RPC client (for testing/debugging)
   */
  getRpcClient(): ZcashRpcClient {
    return this.rpcClient;
  }
}
