import { BitcoinRpcClient, BitcoinTransaction } from './BitcoinRpcClient';
import { ZmqSubscriber, ZmqTopic } from './ZmqSubscriber';
import { paymentRepository } from '../../database/repositories/PaymentRepository';
import { blockchainTransactionRepository } from '../../database/repositories/BlockchainTransactionRepository';
import { webhookEventRepository } from '../../database/repositories/WebhookEventRepository';
import { Payment } from '../../models/Payment';
import { BlockchainTransaction } from '../../models/BlockchainTransaction';
import { PaymentStatus, CryptoCurrency } from '../../types';
import { config } from '../../config';
import { logger } from '../../utils/logger';

/**
 * Bitcoin Monitor Configuration
 */
export interface BitcoinMonitorConfig {
  rpcUrl: string;
  rpcUser: string;
  rpcPass: string;
  zmqEndpoint: string;
  confirmationThreshold: number;
  pollIntervalMs: number;
  addressCacheRefreshMs: number;
}

/**
 * Bitcoin Blockchain Monitor
 *
 * Monitors Bitcoin blockchain for incoming payments using:
 * - ZMQ subscriptions for real-time block/transaction notifications
 * - RPC calls for transaction details and confirmations
 *
 * Flow:
 * 1. Subscribe to ZMQ 'hashblock' and 'rawtx' topics
 * 2. On new transaction: decode, check if destination matches monitored address
 * 3. On match: create blockchain_transaction record, update payment to 'detected'
 * 4. On new block: update confirmations for all pending transactions
 * 5. On confirmation threshold: update payment to 'confirmed', trigger webhook
 */
export class BitcoinMonitor {
  private rpcClient: BitcoinRpcClient;
  private zmqSubscriber: ZmqSubscriber | null = null;
  private addressCache: Set<string> = new Set();
  private addressCacheRefreshInterval: NodeJS.Timer | null = null;
  private confirmationUpdateInterval: NodeJS.Timer | null = null;
  private isRunning: boolean = false;
  private config: BitcoinMonitorConfig;

  constructor(customConfig?: Partial<BitcoinMonitorConfig>) {
    this.config = {
      rpcUrl: customConfig?.rpcUrl || config.bitcoinRpcUrl,
      rpcUser: customConfig?.rpcUser || config.bitcoinRpcUser,
      rpcPass: customConfig?.rpcPass || config.bitcoinRpcPass,
      zmqEndpoint: customConfig?.zmqEndpoint || config.bitcoinZmqEndpoint,
      confirmationThreshold: customConfig?.confirmationThreshold || config.btcConfirmationThreshold,
      pollIntervalMs: customConfig?.pollIntervalMs || config.bitcoinPollIntervalMs,
      addressCacheRefreshMs: customConfig?.addressCacheRefreshMs || 60000, // 60 seconds
    };

    // Initialize RPC client
    this.rpcClient = new BitcoinRpcClient({
      url: this.config.rpcUrl,
      username: this.config.rpcUser,
      password: this.config.rpcPass,
    });

    logger.info('Bitcoin Monitor initialized', {
      rpcUrl: this.config.rpcUrl,
      zmqEndpoint: this.config.zmqEndpoint,
      confirmationThreshold: this.config.confirmationThreshold,
    });
  }

  /**
   * Initialize the monitor (test connections, setup)
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Bitcoin Monitor...');

    // Test RPC connection
    const rpcConnected = await this.rpcClient.testConnection();
    if (!rpcConnected) {
      throw new Error('Failed to connect to Bitcoin RPC');
    }

    // Get blockchain info
    const blockchainInfo = await this.rpcClient.getBlockchainInfo();
    logger.info('Bitcoin RPC connected', {
      chain: blockchainInfo.chain,
      blocks: blockchainInfo.blocks,
      headers: blockchainInfo.headers,
    });

    // Initialize ZMQ subscriber
    this.zmqSubscriber = new ZmqSubscriber({
      endpoint: this.config.zmqEndpoint,
      topics: ['hashblock', 'rawtx'],
    });

    // Register ZMQ handlers
    this.zmqSubscriber.on('hashblock', this.onNewBlock.bind(this));
    this.zmqSubscriber.on('rawtx', this.onNewTransaction.bind(this));

    // Initial address cache load
    await this.refreshAddressCache();

    logger.info('Bitcoin Monitor initialized successfully');
  }

  /**
   * Start the monitor
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Bitcoin Monitor already running');
      return;
    }

    logger.info('Starting Bitcoin Monitor...');

    // Connect ZMQ
    if (this.zmqSubscriber) {
      await this.zmqSubscriber.connect();
    }

    // Start address cache refresh interval
    this.addressCacheRefreshInterval = setInterval(
      () => this.refreshAddressCache(),
      this.config.addressCacheRefreshMs
    );

    // Start confirmation update interval (fallback if ZMQ fails)
    this.confirmationUpdateInterval = setInterval(
      () => this.updateAllConfirmations(),
      this.config.pollIntervalMs
    );

    this.isRunning = true;
    logger.info('Bitcoin Monitor started successfully');
  }

  /**
   * Stop the monitor
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Bitcoin Monitor not running');
      return;
    }

    logger.info('Stopping Bitcoin Monitor...');

    this.isRunning = false;

    // Stop intervals
    if (this.addressCacheRefreshInterval) {
      clearInterval(this.addressCacheRefreshInterval);
      this.addressCacheRefreshInterval = null;
    }

    if (this.confirmationUpdateInterval) {
      clearInterval(this.confirmationUpdateInterval);
      this.confirmationUpdateInterval = null;
    }

    // Disconnect ZMQ
    if (this.zmqSubscriber) {
      await this.zmqSubscriber.disconnect();
    }

    logger.info('Bitcoin Monitor stopped');
  }

  /**
   * ZMQ Handler: New block detected
   */
  private async onNewBlock(topic: string, data: Buffer, sequence: number): Promise<void> {
    const blockHash = data.toString('hex');
    logger.info('New Bitcoin block detected', { blockHash, sequence });

    try {
      // Update confirmations for all unconfirmed transactions
      await this.updateAllConfirmations();
    } catch (error) {
      logger.error('Error updating confirmations on new block', { blockHash, error });
    }
  }

  /**
   * ZMQ Handler: New transaction detected in mempool
   */
  private async onNewTransaction(topic: string, data: Buffer, sequence: number): Promise<void> {
    try {
      // Decode raw transaction
      const txHex = data.toString('hex');
      const decodedTx = await this.rpcClient.decodeRawTransaction(txHex);

      logger.debug('New Bitcoin transaction detected', {
        txid: decodedTx.txid,
        sequence,
        outputCount: decodedTx.vout.length,
      });

      // Check if any outputs match monitored addresses
      for (const vout of decodedTx.vout) {
        const addresses = vout.scriptPubKey.addresses ||
                         (vout.scriptPubKey.address ? [vout.scriptPubKey.address] : []);

        for (const address of addresses) {
          if (this.addressCache.has(address)) {
            logger.info('Payment detected to monitored address', {
              txid: decodedTx.txid,
              address,
              amount: vout.value,
            });

            // Get full transaction details
            const fullTx = await this.rpcClient.getRawTransaction(decodedTx.txid, true) as BitcoinTransaction;
            await this.processTransaction(fullTx);
            break; // Only process once per transaction
          }
        }
      }
    } catch (error) {
      logger.error('Error processing new transaction', { error });
    }
  }

  /**
   * Process a Bitcoin transaction and update payment state
   */
  private async processTransaction(tx: BitcoinTransaction): Promise<void> {
    try {
      // Find payment by destination address
      const payment = await this.matchTransactionToPayment(tx);
      if (!payment) {
        logger.debug('Transaction does not match any active payment', { txid: tx.txid });
        return;
      }

      logger.info('Matched transaction to payment', {
        txid: tx.txid,
        paymentId: payment.id,
        merchantId: payment.merchant_id,
      });

      // Check if already processed
      const existingTx = await blockchainTransactionRepository.findByTxid(tx.txid);
      if (existingTx) {
        logger.debug('Transaction already processed', { txid: tx.txid });
        return;
      }

      // Extract relevant output (matching the payment address)
      const matchedOutput = tx.vout.find(vout => {
        const addresses = vout.scriptPubKey.addresses ||
                         (vout.scriptPubKey.address ? [vout.scriptPubKey.address] : []);
        return addresses.includes(payment.crypto_address);
      });

      if (!matchedOutput) {
        logger.error('Could not find matching output in transaction', { txid: tx.txid });
        return;
      }

      // Create blockchain transaction record
      const blockchainTx = await blockchainTransactionRepository.create({
        payment_id: payment.id,
        crypto_currency: 'BTC' as CryptoCurrency,
        txid: tx.txid,
        from_address: null, // Bitcoin doesn't have clear "from" addresses
        to_address: payment.crypto_address,
        amount: matchedOutput.value.toString(),
        confirmations: tx.confirmations || 0,
        block_height: tx.blockhash ? undefined : undefined, // Will be set when confirmed
        block_hash: tx.blockhash || null,
        is_shielded: false,
        memo: null,
      });

      // Mark payment as detected
      await this.markPaymentDetected(payment, blockchainTx);

      logger.info('Bitcoin payment processed successfully', {
        txid: tx.txid,
        paymentId: payment.id,
        amount: matchedOutput.value,
      });
    } catch (error) {
      logger.error('Error processing Bitcoin transaction', { txid: tx.txid, error });
    }
  }

  /**
   * Match a transaction to a payment by checking destination addresses
   */
  private async matchTransactionToPayment(tx: BitcoinTransaction): Promise<Payment | null> {
    // Extract all destination addresses from outputs
    const addresses = new Set<string>();
    for (const vout of tx.vout) {
      const voutAddresses = vout.scriptPubKey.addresses ||
                           (vout.scriptPubKey.address ? [vout.scriptPubKey.address] : []);
      voutAddresses.forEach(addr => addresses.add(addr));
    }

    // Check each address against our monitored addresses
    for (const address of addresses) {
      if (this.addressCache.has(address)) {
        const payment = await paymentRepository.findByCryptoAddress(address);
        if (payment && payment.crypto_currency === 'BTC' && payment.status === 'pending') {
          return payment;
        }
      }
    }

    return null;
  }

  /**
   * Mark payment as detected (0-conf)
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
      // Find all unconfirmed Bitcoin transactions
      const unconfirmedTxs = await blockchainTransactionRepository.findUnconfirmedTransactions(
        'BTC' as CryptoCurrency,
        this.config.confirmationThreshold
      );

      if (unconfirmedTxs.length === 0) {
        return;
      }

      logger.debug('Updating confirmations for Bitcoin transactions', { count: unconfirmedTxs.length });

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
          let blockHeight = tx.block_height;

          if (confirmations > 0 && !blockHash) {
            const fullTx = await this.rpcClient.getRawTransaction(tx.txid, true) as BitcoinTransaction;
            blockHash = fullTx.blockhash || null;
            // Could also get block height here if needed
          }

          // Update blockchain transaction confirmations
          await blockchainTransactionRepository.updateConfirmations(
            tx.txid,
            confirmations,
            blockHash || undefined,
            blockHeight || undefined
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
            blockHash,
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
   * Update payment confirmations and transition to confirmed if threshold reached
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
      // Find all pending and detected Bitcoin payments
      const payments = await paymentRepository.findByStatus(['pending', 'detected']);
      const btcPayments = payments.filter(p => p.crypto_currency === 'BTC');

      // Build new address set
      const newAddresses = new Set(btcPayments.map(p => p.crypto_address));

      // Log changes
      const added = Array.from(newAddresses).filter(addr => !this.addressCache.has(addr));
      const removed = Array.from(this.addressCache).filter(addr => !newAddresses.has(addr));

      if (added.length > 0 || removed.length > 0) {
        logger.info('Address cache refreshed', {
          total: newAddresses.size,
          added: added.length,
          removed: removed.length,
        });
      }

      this.addressCache = newAddresses;
    } catch (error) {
      logger.error('Error refreshing address cache', { error });
    }
  }

  /**
   * Get monitor status
   */
  getStatus(): {
    isRunning: boolean;
    addressCount: number;
    zmqConnected: boolean;
    rpcConnected: boolean;
  } {
    return {
      isRunning: this.isRunning,
      addressCount: this.addressCache.size,
      zmqConnected: this.zmqSubscriber?.getIsConnected() || false,
      rpcConnected: true, // Would need async check for accurate status
    };
  }

  /**
   * Get RPC client (for testing/debugging)
   */
  getRpcClient(): BitcoinRpcClient {
    return this.rpcClient;
  }
}
