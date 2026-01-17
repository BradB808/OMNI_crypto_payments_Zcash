import { MerchantStatus, FiatCurrency, SettlementSchedule, Metadata } from '../types';

/**
 * Merchant model (public-facing, excludes sensitive fields)
 * Represents a merchant account that accepts crypto payments
 */
export interface Merchant {
  id: string;
  name: string;
  email: string;

  // Webhook configuration
  webhook_url: string | null;

  // Settlement configuration
  settlement_currency: FiatCurrency;
  settlement_schedule: SettlementSchedule;
  settlement_account_id: string | null; // Circle account ID

  // Status
  status: MerchantStatus;

  // Metadata
  metadata: Metadata;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

/**
 * Merchant model with sensitive fields (for internal use only)
 * NEVER expose this directly via API responses
 */
export interface MerchantInternal extends Merchant {
  api_key_hash: string; // Sensitive: used for authentication
  webhook_secret: string; // Sensitive: used for webhook signature verification
}

/**
 * Create merchant input (for registration)
 */
export interface CreateMerchantInput {
  name: string;
  email: string;
  webhook_url?: string;
  settlement_currency?: FiatCurrency;
  settlement_schedule?: SettlementSchedule;
  settlement_account_id?: string;
  metadata?: Metadata;
}

/**
 * Update merchant input
 */
export interface UpdateMerchantInput {
  name?: string;
  email?: string;
  webhook_url?: string;
  settlement_currency?: FiatCurrency;
  settlement_schedule?: SettlementSchedule;
  settlement_account_id?: string;
  status?: MerchantStatus;
  metadata?: Metadata;
}

/**
 * Merchant with API key (only returned once upon creation)
 */
export interface MerchantWithApiKey extends Merchant {
  api_key: string; // Plain text API key (only shown once)
}

/**
 * Public merchant info (safe to expose via API)
 */
export interface PublicMerchant {
  id: string;
  name: string;
  status: MerchantStatus;
  created_at: Date;
}
