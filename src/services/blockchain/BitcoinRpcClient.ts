import { BlockchainRpcClient, RpcConfig, Block } from './BlockchainRpcClient';
import { logger } from '../../utils/logger';

/**
 * Bitcoin Transaction (simplified)
 */
export interface BitcoinTransaction {
  txid: string;
  hash: string;
  version: number;
  size: number;
  vsize: number;
  weight: number;
  locktime: number;
  vin: BitcoinVin[];
  vout: BitcoinVout[];
  hex: string;
  blockhash?: string;
  confirmations?: number;
  time?: number;
  blocktime?: number;
}

/**
 * Bitcoin Transaction Input
 */
export interface BitcoinVin {
  txid?: string;
  vout?: number;
  scriptSig?: {
    asm: string;
    hex: string;
  };
  txinwitness?: string[];
  sequence: number;
  coinbase?: string; // For coinbase transactions
}

/**
 * Bitcoin Transaction Output
 */
export interface BitcoinVout {
  value: number; // Amount in BTC
  n: number; // Output index
  scriptPubKey: {
    asm: string;
    hex: string;
    reqSigs?: number;
    type: string;
    addresses?: string[];
    address?: string; // Single address (newer format)
  };
}

/**
 * Bitcoin UTXO (Unspent Transaction Output)
 */
export interface BitcoinUtxo {
  txid: string;
  vout: number;
  address: string;
  label?: string;
  scriptPubKey: string;
  amount: number;
  confirmations: number;
  spendable: boolean;
  solvable: boolean;
  safe: boolean;
}

/**
 * Decoded Raw Transaction
 */
export interface DecodedRawTransaction {
  txid: string;
  hash: string;
  version: number;
  size: number;
  vsize: number;
  weight: number;
  locktime: number;
  vin: BitcoinVin[];
  vout: BitcoinVout[];
}

/**
 * Bitcoin-specific RPC client
 * Extends base RPC client with Bitcoin Core methods
 */
export class BitcoinRpcClient extends BlockchainRpcClient {
  constructor(config: RpcConfig) {
    super(config);
    logger.info('Bitcoin RPC client initialized', {
      url: config.url,
    });
  }

  /**
   * Get raw transaction by txid
   * @param txid Transaction ID
   * @param verbose true = JSON object, false = hex string
   */
  async getRawTransaction(txid: string, verbose: boolean = true): Promise<BitcoinTransaction | string> {
    if (verbose) {
      return await this.call<BitcoinTransaction>('getrawtransaction', [txid, true]);
    } else {
      return await this.call<string>('getrawtransaction', [txid, false]);
    }
  }

  /**
   * Get transaction details
   * @param txid Transaction ID
   * @param includeWatchonly Include watch-only addresses
   */
  async getTransaction(txid: string, includeWatchonly: boolean = false): Promise<any> {
    return await this.call<any>('gettransaction', [txid, includeWatchonly]);
  }

  /**
   * Decode raw transaction hex
   */
  async decodeRawTransaction(hexString: string): Promise<DecodedRawTransaction> {
    return await this.call<DecodedRawTransaction>('decoderawtransaction', [hexString]);
  }

  /**
   * Send raw transaction to network
   */
  async sendRawTransaction(hexString: string): Promise<string> {
    return await this.call<string>('sendrawtransaction', [hexString]);
  }

  /**
   * List unspent transaction outputs
   * @param minconf Minimum confirmations (default: 1)
   * @param maxconf Maximum confirmations (default: 9999999)
   * @param addresses Filter by addresses
   */
  async listUnspent(
    minconf: number = 1,
    maxconf: number = 9999999,
    addresses?: string[]
  ): Promise<BitcoinUtxo[]> {
    const params: any[] = [minconf, maxconf];
    if (addresses && addresses.length > 0) {
      params.push(addresses);
    }
    return await this.call<BitcoinUtxo[]>('listunspent', params);
  }

  /**
   * List transactions for the wallet
   * @param label Label filter (default: "*")
   * @param count Number of transactions (default: 10)
   * @param skip Skip transactions (default: 0)
   * @param includeWatchonly Include watch-only addresses
   */
  async listTransactions(
    label: string = '*',
    count: number = 10,
    skip: number = 0,
    includeWatchonly: boolean = false
  ): Promise<any[]> {
    return await this.call<any[]>('listtransactions', [label, count, skip, includeWatchonly]);
  }

  /**
   * Get mempool information
   */
  async getMempoolInfo(): Promise<any> {
    return await this.call<any>('getmempoolinfo');
  }

  /**
   * Get raw mempool
   * @param verbose true = JSON object with details, false = array of txids
   */
  async getRawMempool(verbose: boolean = false): Promise<string[] | any> {
    return await this.call<string[] | any>('getrawmempool', [verbose]);
  }

  /**
   * Get mempool entry for transaction
   */
  async getMempoolEntry(txid: string): Promise<any> {
    return await this.call<any>('getmempoolentry', [txid]);
  }

  /**
   * Import address to watch (for monitoring payments)
   * @param address Bitcoin address
   * @param label Optional label
   * @param rescan Whether to rescan blockchain (use false for efficiency)
   */
  async importAddress(address: string, label: string = '', rescan: boolean = false): Promise<void> {
    await this.call<void>('importaddress', [address, label, rescan]);
  }

  /**
   * Get received amount by address
   * @param address Bitcoin address
   * @param minconf Minimum confirmations
   */
  async getReceivedByAddress(address: string, minconf: number = 1): Promise<number> {
    return await this.call<number>('getreceivedbyaddress', [address, minconf]);
  }

  /**
   * List received transactions by address
   * @param minconf Minimum confirmations
   * @param includeEmpty Include addresses with zero balance
   * @param includeWatchonly Include watch-only addresses
   */
  async listReceivedByAddress(
    minconf: number = 1,
    includeEmpty: boolean = false,
    includeWatchonly: boolean = true
  ): Promise<any[]> {
    return await this.call<any[]>('listreceivedbyaddress', [minconf, includeEmpty, includeWatchonly]);
  }

  /**
   * Get new address from wallet
   * @param label Optional label
   * @param addressType Address type: "legacy", "p2sh-segwit", "bech32"
   */
  async getNewAddress(label: string = '', addressType: string = 'bech32'): Promise<string> {
    return await this.call<string>('getnewaddress', [label, addressType]);
  }

  /**
   * Estimate smart fee
   * @param confTarget Confirmation target in blocks
   * @param estimateMode "UNSET", "ECONOMICAL", "CONSERVATIVE"
   */
  async estimateSmartFee(confTarget: number = 6, estimateMode: string = 'CONSERVATIVE'): Promise<any> {
    return await this.call<any>('estimatesmartfee', [confTarget, estimateMode]);
  }

  /**
   * Get wallet info
   */
  async getWalletInfo(): Promise<any> {
    return await this.call<any>('getwalletinfo');
  }

  /**
   * Get balance
   * @param dummy Dummy parameter (for backwards compatibility)
   * @param minconf Minimum confirmations
   * @param includeWatchonly Include watch-only addresses
   */
  async getBalance(dummy: string = '*', minconf: number = 0, includeWatchonly: boolean = true): Promise<number> {
    return await this.call<number>('getbalance', [dummy, minconf, includeWatchonly]);
  }

  /**
   * Send to address
   * @param address Destination address
   * @param amount Amount in BTC
   * @param comment Optional comment
   * @param commentTo Optional comment to
   */
  async sendToAddress(
    address: string,
    amount: number,
    comment?: string,
    commentTo?: string
  ): Promise<string> {
    const params: any[] = [address, amount];
    if (comment) params.push(comment);
    if (commentTo) params.push(commentTo);
    return await this.call<string>('sendtoaddress', params);
  }

  /**
   * Test mempool accept (check if transaction would be accepted)
   */
  async testMempoolAccept(rawTxs: string[]): Promise<any[]> {
    return await this.call<any[]>('testmempoolaccept', [rawTxs]);
  }

  /**
   * Get transaction outputs (UTXOs) for given addresses
   * Useful for checking if payment has been received
   */
  async scantxoutset(action: 'start' | 'abort' | 'status', scanObjects: any[]): Promise<any> {
    return await this.call<any>('scantxoutset', [action, scanObjects]);
  }

  /**
   * Get best block hash (latest block)
   */
  async getBestBlockHash(): Promise<string> {
    return await this.call<string>('getbestblockhash');
  }

  /**
   * Get difficulty
   */
  async getDifficulty(): Promise<number> {
    return await this.call<number>('getdifficulty');
  }

  /**
   * Check if transaction is in mempool
   */
  async isTransactionInMempool(txid: string): Promise<boolean> {
    try {
      await this.getMempoolEntry(txid);
      return true;
    } catch (error: any) {
      // Error code -5 means transaction not found in mempool
      if (error.code === -5) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get confirmations for a transaction
   * Returns 0 if in mempool, -1 if not found
   */
  async getTransactionConfirmations(txid: string): Promise<number> {
    try {
      const tx = await this.getRawTransaction(txid, true) as BitcoinTransaction;
      return tx.confirmations || 0;
    } catch (error: any) {
      // Check if in mempool
      const inMempool = await this.isTransactionInMempool(txid);
      if (inMempool) {
        return 0; // In mempool = 0 confirmations
      }
      return -1; // Not found
    }
  }
}
