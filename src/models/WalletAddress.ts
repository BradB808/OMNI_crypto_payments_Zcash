import { CryptoCurrency, AddressType } from '../types';

/**
 * WalletAddress model
 * Represents generated crypto addresses for payments
 */
export interface WalletAddress {
  id: string;

  // Address details
  crypto_currency: CryptoCurrency;
  address: string;
  address_type: AddressType;

  // Derivation info
  derivation_path: string;

  // Usage tracking
  payment_id: string | null;
  is_used: boolean;
  used_at: Date | null;

  // Zcash specific (for shielded addresses)
  // AES-256-GCM encryption requires all three components for decryption
  view_key: string | null; // Encrypted view key (ciphertext)
  view_key_iv: string | null; // Initialization vector for decryption
  view_key_auth_tag: string | null; // Authentication tag for decryption

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

/**
 * Create wallet address input
 */
export interface CreateWalletAddressInput {
  crypto_currency: CryptoCurrency;
  address: string;
  address_type: AddressType;
  derivation_path: string;
  view_key?: string;
  view_key_iv?: string;
  view_key_auth_tag?: string;
}

/**
 * Update wallet address input
 */
export interface UpdateWalletAddressInput {
  payment_id?: string;
  is_used?: boolean;
  used_at?: Date;
}

/**
 * Wallet address pool statistics
 */
export interface WalletAddressPoolStats {
  crypto_currency: CryptoCurrency;
  total_addresses: number;
  used_addresses: number;
  available_addresses: number;
  address_type: AddressType;
}
