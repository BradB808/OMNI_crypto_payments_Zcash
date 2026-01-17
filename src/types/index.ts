/**
 * Core type definitions and enums for OMNI Crypto Payments
 */

// =====================================================
// ENUMS
// =====================================================

export enum PaymentStatus {
  PENDING = 'pending',
  DETECTED = 'detected',
  CONFIRMING = 'confirming',
  CONFIRMED = 'confirmed',
  CONVERTING = 'converting',
  CONVERTED = 'converted',
  SETTLING = 'settling',
  SETTLED = 'settled',
  EXPIRED = 'expired',
  FAILED = 'failed',
}

export enum CryptoCurrency {
  BTC = 'BTC',
  ZEC = 'ZEC',
}

export enum FiatCurrency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
}

export enum MerchantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CLOSED = 'closed',
}

export enum SettlementSchedule {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export enum SettlementStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum WebhookEventType {
  PAYMENT_DETECTED = 'payment.detected',
  PAYMENT_CONFIRMED = 'payment.confirmed',
  PAYMENT_CONVERTED = 'payment.converted',
  PAYMENT_SETTLED = 'payment.settled',
  PAYMENT_EXPIRED = 'payment.expired',
  PAYMENT_FAILED = 'payment.failed',
}

export enum WebhookStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

export enum ConversionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum AddressType {
  TRANSPARENT = 'transparent',
  SHIELDED = 'shielded',
}

// =====================================================
// COMMON TYPES
// =====================================================

export interface Metadata {
  [key: string]: any;
}

export interface Pagination {
  limit: number;
  offset: number;
  total?: number;
}

export interface PaginatedResponse<T> {
  object: 'list';
  data: T[];
  has_more: boolean;
  total?: number;
  url: string;
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

export interface CreatePaymentRequest {
  order_id: string;
  amount: number;
  currency: FiatCurrency;
  crypto_currency: CryptoCurrency;
  description?: string;
  metadata?: Metadata;
  success_url?: string;
  cancel_url?: string;
}

export interface CreatePaymentResponse {
  id: string;
  object: 'payment';
  status: PaymentStatus;
  order_id: string;
  amount: number;
  currency: FiatCurrency;
  crypto_currency: CryptoCurrency;
  crypto_amount: string;
  crypto_address: string;
  qr_code_url: string;
  hosted_payment_url: string;
  exchange_rate: string;
  expires_at: string;
  created_at: string;
}

export interface PaymentResponse {
  id: string;
  object: 'payment';
  status: PaymentStatus;
  order_id: string;
  amount: number;
  currency: FiatCurrency;
  crypto_currency: CryptoCurrency;
  crypto_amount: string;
  crypto_address: string;
  exchange_rate: string;
  txid?: string;
  confirmations?: number;
  detected_at?: string;
  confirmed_at?: string;
  usdc_amount?: string;
  conversion_rate?: string;
  conversion_fee?: string;
  converted_at?: string;
  settlement_id?: string;
  settled_at?: string;
  created_at: string;
  expires_at: string;
  metadata?: Metadata;
}

export interface SettlementResponse {
  id: string;
  object: 'settlement';
  status: SettlementStatus;
  payment_count: number;
  total_amount: number;
  currency: FiatCurrency;
  fee: number;
  net_amount: number;
  completed_at?: string;
  created_at: string;
}

// =====================================================
// WEBHOOK TYPES
// =====================================================

export interface WebhookPayload {
  id: string;
  type: WebhookEventType;
  created_at: string;
  data: {
    object: PaymentResponse | SettlementResponse;
  };
}

// =====================================================
// BLOCKCHAIN TYPES
// =====================================================

export interface BitcoinTransaction {
  txid: string;
  confirmations: number;
  blockHeight?: number;
  blockHash?: string;
  amount: string;
  address: string;
  timestamp: number;
}

export interface ZcashTransaction {
  txid: string;
  confirmations: number;
  blockHeight?: number;
  blockHash?: string;
  amount: string;
  address: string;
  isShielded: boolean;
  memo?: string;
  timestamp: number;
}

export interface BlockchainMonitorEvent {
  currency: CryptoCurrency;
  address: string;
  txid: string;
  amount: string;
  confirmations: number;
  isShielded?: boolean;
  memo?: string;
}

// =====================================================
// CIRCLE API TYPES
// =====================================================

export interface CircleExchangeRate {
  from: CryptoCurrency;
  to: FiatCurrency;
  rate: string;
  timestamp: string;
}

export interface CircleConversionRequest {
  amount: string;
  from: CryptoCurrency;
  to: 'USDC';
}

export interface CirclePayoutRequest {
  amount: string;
  currency: FiatCurrency;
  destination: {
    type: 'bank_account';
    id: string;
  };
}

// =====================================================
// WALLET TYPES
// =====================================================

export interface HDWalletConfig {
  mnemonic?: string;
  seed?: Buffer;
  network: 'mainnet' | 'testnet' | 'regtest';
}

export interface AddressDerivation {
  address: string;
  derivationPath: string;
  index: number;
  publicKey: string;
}

export interface ZcashShieldedAddress {
  address: string;
  viewKey: string; // Encrypted view key (ciphertext)
  viewKeyIv: string; // Initialization vector for decryption
  viewKeyAuthTag: string; // Authentication tag for decryption
  derivationPath: string;
  index: number;
}

// =====================================================
// UTILITY TYPES
// =====================================================

export type Decimal = string; // Decimal values stored as strings for precision

export interface TimestampFields {
  created_at: Date;
  updated_at: Date;
}

export interface OptionalTimestampFields extends TimestampFields {
  deleted_at?: Date;
}
