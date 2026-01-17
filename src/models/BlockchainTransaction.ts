import { CryptoCurrency, Decimal } from '../types';

/**
 * BlockchainTransaction model
 * Represents raw blockchain transaction data
 */
export interface BlockchainTransaction {
  id: string;
  payment_id: string;

  // Transaction details
  crypto_currency: CryptoCurrency;
  txid: string;
  from_address: string | null;
  to_address: string;
  amount: Decimal;

  // Block information
  confirmations: number;
  block_height: number | null;
  block_hash: string | null;

  // Zcash specific
  is_shielded: boolean;
  memo: string | null;

  // Timestamps
  detected_at: Date;
  confirmed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create blockchain transaction input
 */
export interface CreateBlockchainTransactionInput {
  payment_id: string;
  crypto_currency: CryptoCurrency;
  txid: string;
  from_address?: string;
  to_address: string;
  amount: Decimal;
  confirmations?: number;
  block_height?: number;
  block_hash?: string;
  is_shielded?: boolean;
  memo?: string;
}

/**
 * Update blockchain transaction input
 */
export interface UpdateBlockchainTransactionInput {
  confirmations?: number;
  block_height?: number;
  block_hash?: string;
  confirmed_at?: Date;
}
