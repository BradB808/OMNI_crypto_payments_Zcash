import { PaymentStatus, CryptoCurrency, FiatCurrency, Metadata, Decimal } from '../types';

/**
 * Payment model
 * Represents an individual payment request from a merchant
 */
export interface Payment {
  id: string;
  merchant_id: string;

  // Merchant-provided data
  order_id: string;
  amount_fiat: Decimal; // Stored as string for precision
  currency: FiatCurrency;
  description: string | null;
  metadata: Metadata;

  // Merchant redirect URLs
  success_url: string | null;
  cancel_url: string | null;

  // Crypto payment details
  crypto_currency: CryptoCurrency;
  crypto_amount: Decimal;
  crypto_address: string;
  exchange_rate: Decimal;

  // Payment status
  status: PaymentStatus;

  // Transaction tracking
  txid: string | null;
  confirmations: number;
  detected_at: Date | null;
  confirmed_at: Date | null;

  // Conversion tracking
  usdc_amount: Decimal | null;
  conversion_rate: Decimal | null;
  conversion_fee: Decimal | null;
  converted_at: Date | null;

  // Settlement tracking
  settlement_id: string | null;
  settled_at: Date | null;

  // Payment lifecycle
  expires_at: Date;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

/**
 * Create payment input
 */
export interface CreatePaymentInput {
  merchant_id: string;
  order_id: string;
  amount_fiat: Decimal; // Stored as string for precision
  currency: FiatCurrency;
  crypto_currency: CryptoCurrency;
  description?: string;
  metadata?: Metadata;
  success_url?: string;
  cancel_url?: string;
}

/**
 * Update payment input
 */
export interface UpdatePaymentInput {
  status?: PaymentStatus;
  txid?: string;
  confirmations?: number;
  detected_at?: Date;
  confirmed_at?: Date;
  usdc_amount?: Decimal;
  conversion_rate?: Decimal;
  conversion_fee?: Decimal;
  converted_at?: Date;
  settlement_id?: string;
  settled_at?: Date;
}

/**
 * Payment with computed fields (for API responses)
 */
export interface PaymentWithComputed extends Payment {
  qr_code_url: string;
  hosted_payment_url: string;
  is_expired: boolean;
  remaining_confirmations: number;
}

/**
 * Payment filters (for querying)
 */
export interface PaymentFilters {
  merchant_id?: string;
  status?: PaymentStatus | PaymentStatus[];
  crypto_currency?: CryptoCurrency;
  order_id?: string;
  created_after?: Date;
  created_before?: Date;
  expires_after?: Date;
  expires_before?: Date;
}

/**
 * Payment state transition metadata
 */
export interface PaymentStateTransition {
  from: PaymentStatus;
  to: PaymentStatus;
  timestamp: Date;
  reason?: string;
  metadata?: Metadata;
}

/**
 * Payment summary (for merchant dashboard)
 */
export interface PaymentSummary {
  total_payments: number;
  total_amount_fiat: number;
  total_amount_crypto: Decimal;
  currency: FiatCurrency;
  crypto_currency: CryptoCurrency;
  status_breakdown: Record<PaymentStatus, number>;
}
