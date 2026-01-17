import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../../utils/logger';
import { DatabaseError } from '../../utils/errors';

/**
 * RPC Error
 * Represents an error from blockchain RPC calls
 */
export class RpcError extends Error {
  constructor(
    message: string,
    public code: number | string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

/**
 * RPC Configuration
 */
export interface RpcConfig {
  url: string;
  username: string;
  password: string;
  timeout?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Generic Block interface
 */
export interface Block {
  hash: string;
  height: number;
  confirmations: number;
  time: number;
  previousblockhash?: string;
  nextblockhash?: string;
  tx: string[]; // Transaction IDs
}

/**
 * Base class for blockchain RPC clients
 * Provides common functionality for Bitcoin and Zcash RPC communication
 */
export abstract class BlockchainRpcClient {
  protected client: AxiosInstance;
  protected config: Required<RpcConfig>;
  protected requestId: number = 0;

  constructor(config: RpcConfig) {
    this.config = {
      url: config.url,
      username: config.username,
      password: config.password,
      timeout: config.timeout || 30000, // 30 second default
      maxRetries: config.maxRetries || 3,
      retryDelayMs: config.retryDelayMs || 1000,
    };

    // Create axios instance with basic auth
    this.client = axios.create({
      baseURL: this.config.url,
      timeout: this.config.timeout,
      auth: {
        username: this.config.username,
        password: this.config.password,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.info('Blockchain RPC client initialized', {
      url: this.config.url,
      timeout: this.config.timeout,
    });
  }

  /**
   * Make an RPC call with automatic retry logic
   */
  protected async call<T>(method: string, params: any[] = []): Promise<T> {
    const requestId = ++this.requestId;
    const payload = {
      jsonrpc: '1.0',
      id: requestId,
      method,
      params,
    };

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < this.config.maxRetries) {
      attempt++;

      try {
        logger.debug('RPC call', { method, params, attempt, requestId });

        const response = await this.client.post('/', payload);

        // Check for RPC error in response
        if (response.data.error) {
          throw new RpcError(
            response.data.error.message || 'RPC error',
            response.data.error.code || -1,
            response.data.error
          );
        }

        // Success
        logger.debug('RPC call successful', { method, requestId });
        return response.data.result as T;
      } catch (error) {
        lastError = this.handleRpcError(error, method, attempt);

        // Don't retry on certain errors
        if (this.shouldNotRetry(error)) {
          throw lastError;
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          logger.warn('RPC call failed, retrying...', {
            method,
            attempt,
            maxRetries: this.config.maxRetries,
            retryDelayMs: delay,
          });
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    logger.error('RPC call failed after all retries', {
      method,
      attempts: this.config.maxRetries,
      error: lastError,
    });
    throw lastError;
  }

  /**
   * Handle RPC errors and convert to appropriate error types
   */
  protected handleRpcError(error: any, method: string, attempt: number): Error {
    if (error instanceof RpcError) {
      // Already an RpcError, just log and return
      logger.error('RPC error', {
        method,
        attempt,
        code: error.code,
        message: error.message,
      });
      return error;
    }

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // Network/connection errors
      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ETIMEDOUT') {
        logger.error('RPC connection error', {
          method,
          attempt,
          code: axiosError.code,
          message: axiosError.message,
        });
        return new RpcError(
          `Connection failed: ${axiosError.message}`,
          axiosError.code || 'NETWORK_ERROR',
          axiosError
        );
      }

      // HTTP errors
      if (axiosError.response) {
        logger.error('RPC HTTP error', {
          method,
          attempt,
          status: axiosError.response.status,
          data: axiosError.response.data,
        });
        return new RpcError(
          `HTTP ${axiosError.response.status}: ${JSON.stringify(axiosError.response.data)}`,
          axiosError.response.status,
          axiosError
        );
      }
    }

    // Unknown error
    logger.error('RPC unknown error', { method, attempt, error });
    return error instanceof Error ? error : new Error(String(error));
  }

  /**
   * Determine if an error should not be retried
   */
  protected shouldNotRetry(error: any): boolean {
    if (error instanceof RpcError) {
      // Don't retry on method not found or invalid params
      if (error.code === -32601 || error.code === -32602) {
        return true;
      }

      // Don't retry on transaction/block not found (these are expected)
      if (error.code === -5 || error.code === -8) {
        return true;
      }
    }

    return false;
  }

  /**
   * Sleep utility for retry delays
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current block count (blockchain height)
   */
  async getBlockCount(): Promise<number> {
    return await this.call<number>('getblockcount');
  }

  /**
   * Get block hash at specific height
   */
  async getBlockHash(height: number): Promise<string> {
    return await this.call<string>('getblockhash', [height]);
  }

  /**
   * Get block by hash
   * @param hash Block hash
   * @param verbose 1 = JSON object, 0 = hex string
   */
  async getBlock(hash: string, verbose: number = 1): Promise<Block> {
    return await this.call<Block>('getblock', [hash, verbose]);
  }

  /**
   * Get blockchain information
   */
  async getBlockchainInfo(): Promise<any> {
    return await this.call<any>('getblockchaininfo');
  }

  /**
   * Get network information
   */
  async getNetworkInfo(): Promise<any> {
    return await this.call<any>('getnetworkinfo');
  }

  /**
   * Validate address
   */
  async validateAddress(address: string): Promise<any> {
    return await this.call<any>('validateaddress', [address]);
  }

  /**
   * Test connection to RPC server
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getBlockCount();
      return true;
    } catch (error) {
      logger.error('RPC connection test failed', { error });
      return false;
    }
  }

  /**
   * Get connection info for logging
   */
  getConnectionInfo(): { url: string; timeout: number } {
    return {
      url: this.config.url,
      timeout: this.config.timeout,
    };
  }
}
