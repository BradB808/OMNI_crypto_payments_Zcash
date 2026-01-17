import { BlockchainRpcClient, RpcConfig, Block } from './BlockchainRpcClient';
import { logger } from '../../utils/logger';

/**
 * Zcash Transaction (simplified)
 */
export interface ZcashTransaction {
  txid: string;
  version: number;
  locktime: number;
  vin: ZcashVin[];
  vout: ZcashVout[];
  vjoinsplit?: any[]; // JoinSplit descriptions
  valueBalance?: number; // Shielded value balance
  vShieldedSpend?: any[]; // Shielded spends (Sapling)
  vShieldedOutput?: any[]; // Shielded outputs (Sapling)
  hex: string;
  blockhash?: string;
  confirmations?: number;
  time?: number;
  blocktime?: number;
}

/**
 * Zcash Transaction Input
 */
export interface ZcashVin {
  txid?: string;
  vout?: number;
  scriptSig?: {
    asm: string;
    hex: string;
  };
  sequence: number;
  coinbase?: string; // For coinbase transactions
}

/**
 * Zcash Transaction Output
 */
export interface ZcashVout {
  value: number; // Amount in ZEC
  valueZat?: number; // Amount in zatoshis
  n: number; // Output index
  scriptPubKey: {
    asm: string;
    hex: string;
    reqSigs?: number;
    type: string;
    addresses?: string[];
  };
}

/**
 * Zcash Shielded Address Info
 */
export interface ZcashAddressInfo {
  isvalid: boolean;
  address: string;
  type?: 'sprout' | 'sapling' | 'transparent';
  ismine?: boolean;
  diversifier?: string;
  diversifiedtransmissionkey?: string;
}

/**
 * Zcash Received by Address Entry
 */
export interface ZcashReceivedByAddress {
  txid: string;
  amount: number;
  amountZat?: number;
  memo?: string; // Hex-encoded memo
  confirmations: number;
  blockheight: number;
  blockindex: number;
  blocktime: number;
  jsindex?: number;
  jsoutindex?: number;
  outindex?: number;
  change: boolean;
}

/**
 * Zcash UTXO
 */
export interface ZcashUtxo {
  txid: string;
  vout: number;
  generated?: boolean;
  address: string;
  scriptPubKey: string;
  amount: number;
  confirmations: number;
  spendable: boolean;
}

/**
 * Zcash Operation Status
 */
export interface ZcashOperationStatus {
  id: string;
  status: 'queued' | 'executing' | 'success' | 'failed' | 'cancelled';
  creation_time: number;
  result?: any;
  error?: any;
  method?: string;
  params?: any;
}

/**
 * Zcash-specific RPC client
 * Extends base RPC client with Zcash daemon methods
 */
export class ZcashRpcClient extends BlockchainRpcClient {
  constructor(config: RpcConfig) {
    super(config);
    logger.info('Zcash RPC client initialized', {
      url: config.url,
    });
  }

  /**
   * Get raw transaction by txid
   * @param txid Transaction ID
   * @param verbose 1 = JSON object, 0 = hex string
   */
  async getRawTransaction(txid: string, verbose: number = 1): Promise<ZcashTransaction | string> {
    if (verbose === 1) {
      return await this.call<ZcashTransaction>('getrawtransaction', [txid, verbose]);
    } else {
      return await this.call<string>('getrawtransaction', [txid, verbose]);
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txid: string): Promise<any> {
    return await this.call<any>('gettransaction', [txid]);
  }

  /**
   * List unspent transaction outputs (transparent addresses)
   */
  async listUnspent(
    minconf: number = 1,
    maxconf: number = 9999999,
    addresses?: string[]
  ): Promise<ZcashUtxo[]> {
    const params: any[] = [minconf, maxconf];
    if (addresses && addresses.length > 0) {
      params.push(addresses);
    }
    return await this.call<ZcashUtxo[]>('listunspent', params);
  }

  /**
   * Validate address (transparent or shielded)
   */
  async validateAddress(address: string): Promise<any> {
    return await this.call<any>('validateaddress', [address]);
  }

  /**
   * Get address information (z-address specific)
   */
  async z_validateAddress(address: string): Promise<ZcashAddressInfo> {
    return await this.call<ZcashAddressInfo>('z_validateaddress', [address]);
  }

  /**
   * List received transactions by address (transparent)
   */
  async listReceivedByAddress(
    minconf: number = 1,
    includeEmpty: boolean = false,
    includeWatchonly: boolean = true
  ): Promise<any[]> {
    return await this.call<any[]>('listreceivedbyaddress', [minconf, includeEmpty, includeWatchonly]);
  }

  /**
   * List received by shielded address
   * @param address Shielded address (z-address)
   * @param minconf Minimum confirmations (default: 1)
   */
  async z_listReceivedByAddress(
    address: string,
    minconf: number = 1
  ): Promise<ZcashReceivedByAddress[]> {
    return await this.call<ZcashReceivedByAddress[]>('z_listreceivedbyaddress', [address, minconf]);
  }

  /**
   * Get balance for shielded address
   * @param address Shielded address (z-address)
   * @param minconf Minimum confirmations (default: 1)
   */
  async z_getBalance(address: string, minconf: number = 1): Promise<number> {
    return await this.call<number>('z_getbalance', [address, minconf]);
  }

  /**
   * Get total balance (transparent + shielded)
   * @param minconf Minimum confirmations
   * @param includeWatchonly Include watch-only addresses
   */
  async z_getTotalBalance(minconf: number = 1, includeWatchonly: boolean = false): Promise<any> {
    return await this.call<any>('z_gettotalbalance', [minconf, includeWatchonly]);
  }

  /**
   * List all shielded addresses
   */
  async z_listAddresses(): Promise<string[]> {
    return await this.call<string[]>('z_listaddresses');
  }

  /**
   * Get new shielded address (Sapling)
   * @param type Address type: "sapling" or "sprout" (default: "sapling")
   */
  async z_getNewAddress(type: string = 'sapling'): Promise<string> {
    return await this.call<string>('z_getnewaddress', [type]);
  }

  /**
   * Export viewing key for shielded address
   * @param address Shielded address
   */
  async z_exportViewingKey(address: string): Promise<string> {
    return await this.call<string>('z_exportviewingkey', [address]);
  }

  /**
   * Import viewing key (for monitoring without spending capability)
   * @param vkey Viewing key
   * @param rescan "yes", "no", or "whenkeyisnew" (default)
   * @param startHeight Block height to start rescan (default: 0)
   */
  async z_importViewingKey(
    vkey: string,
    rescan: string = 'whenkeyisnew',
    startHeight: number = 0
  ): Promise<void> {
    return await this.call<void>('z_importviewingkey', [vkey, rescan, startHeight]);
  }

  /**
   * Export spending key (DANGEROUS - only use for backup)
   * @param address Shielded address
   */
  async z_exportKey(address: string): Promise<string> {
    return await this.call<string>('z_exportkey', [address]);
  }

  /**
   * Import spending key
   * @param key Spending key
   * @param rescan "yes", "no", or "whenkeyisnew"
   * @param startHeight Block height to start rescan
   */
  async z_importKey(
    key: string,
    rescan: string = 'whenkeyisnew',
    startHeight: number = 0
  ): Promise<void> {
    return await this.call<void>('z_importkey', [key, rescan, startHeight]);
  }

  /**
   * Send transaction (transparent or shielded)
   * @param fromAddress Source address (t-addr or z-addr)
   * @param amounts Array of {address, amount, memo?}
   * @param minconf Minimum confirmations
   * @param fee Transaction fee (optional)
   */
  async z_sendMany(
    fromAddress: string,
    amounts: Array<{ address: string; amount: number; memo?: string }>,
    minconf: number = 1,
    fee: number = 0.0001
  ): Promise<string> {
    return await this.call<string>('z_sendmany', [fromAddress, amounts, minconf, fee]);
  }

  /**
   * Get operation status
   * @param operationIds Array of operation IDs (from z_sendmany, etc.)
   */
  async z_getOperationStatus(operationIds?: string[]): Promise<ZcashOperationStatus[]> {
    const params = operationIds ? [operationIds] : [];
    return await this.call<ZcashOperationStatus[]>('z_getoperationstatus', params);
  }

  /**
   * Get operation result
   * @param operationIds Array of operation IDs
   */
  async z_getOperationResult(operationIds?: string[]): Promise<ZcashOperationStatus[]> {
    const params = operationIds ? [operationIds] : [];
    return await this.call<ZcashOperationStatus[]>('z_getoperationresult', params);
  }

  /**
   * List operation IDs
   */
  async z_listOperationIds(status?: string): Promise<string[]> {
    const params = status ? [status] : [];
    return await this.call<string[]>('z_listoperationids', params);
  }

  /**
   * Get wallet info
   */
  async getWalletInfo(): Promise<any> {
    return await this.call<any>('getwalletinfo');
  }

  /**
   * Get balance (transparent)
   */
  async getBalance(account: string = '*', minconf: number = 1): Promise<number> {
    return await this.call<number>('getbalance', [account, minconf]);
  }

  /**
   * Send to address (transparent)
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
   * Get new address (transparent)
   */
  async getNewAddress(): Promise<string> {
    return await this.call<string>('getnewaddress');
  }

  /**
   * Get mempool info
   */
  async getMempoolInfo(): Promise<any> {
    return await this.call<any>('getmempoolinfo');
  }

  /**
   * Get raw mempool
   */
  async getRawMempool(verbose: boolean = false): Promise<string[] | any> {
    return await this.call<string[] | any>('getrawmempool', [verbose]);
  }

  /**
   * Import address (transparent, for monitoring)
   */
  async importAddress(address: string, label: string = '', rescan: boolean = false): Promise<void> {
    await this.call<void>('importaddress', [address, label, rescan]);
  }

  /**
   * Get received by address (transparent)
   */
  async getReceivedByAddress(address: string, minconf: number = 1): Promise<number> {
    return await this.call<number>('getreceivedbyaddress', [address, minconf]);
  }

  /**
   * Check if transaction is in mempool
   */
  async isTransactionInMempool(txid: string): Promise<boolean> {
    try {
      const mempool = await this.getRawMempool(false) as string[];
      return mempool.includes(txid);
    } catch (error) {
      logger.error('Failed to check mempool for transaction', { txid, error });
      return false;
    }
  }

  /**
   * Get confirmations for a transaction
   * Returns 0 if in mempool, -1 if not found
   */
  async getTransactionConfirmations(txid: string): Promise<number> {
    try {
      const tx = await this.getRawTransaction(txid, 1) as ZcashTransaction;
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

  /**
   * Decode memo field from hex
   * @param memoHex Hex-encoded memo from z_listreceivedbyaddress
   */
  decodeMemo(memoHex: string): string {
    if (!memoHex || memoHex === '') return '';
    try {
      // Remove null bytes and decode
      const buffer = Buffer.from(memoHex, 'hex');
      const decoded = buffer.toString('utf8').replace(/\0/g, '');
      return decoded;
    } catch (error) {
      logger.error('Failed to decode memo', { memoHex, error });
      return '';
    }
  }

  /**
   * Encode memo field to hex
   * @param memo Plain text memo (max 512 bytes)
   */
  encodeMemo(memo: string): string {
    if (!memo || memo === '') return '';
    try {
      const buffer = Buffer.from(memo, 'utf8');
      if (buffer.length > 512) {
        throw new Error('Memo exceeds 512 byte limit');
      }
      return buffer.toString('hex');
    } catch (error) {
      logger.error('Failed to encode memo', { memo, error });
      throw error;
    }
  }
}
