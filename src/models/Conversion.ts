import { CryptoCurrency, ConversionStatus, Decimal } from '../types';

/**
 * Conversion model
 * Represents a crypto to USDC conversion
 */
export interface Conversion {
  id: string;
  payment_id: string;

  // Conversion details
  from_currency: CryptoCurrency;
  from_amount: Decimal;
  to_currency: string; // Always 'USDC'
  to_amount: Decimal;

  // Rates and fees
  exchange_rate: Decimal;
  fee: Decimal;

  // Circle integration
  circle_transaction_id: string | null;

  // Status
  status: ConversionStatus;
  error_message: string | null;

  // Timestamps
  initiated_at: Date;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create conversion input
 */
export interface CreateConversionInput {
  payment_id: string;
  from_currency: CryptoCurrency;
  from_amount: Decimal;
  to_currency?: string;
  to_amount: Decimal;
  exchange_rate: Decimal;
  fee: Decimal;
}

/**
 * Update conversion input
 */
export interface UpdateConversionInput {
  status?: ConversionStatus;
  circle_transaction_id?: string;
  error_message?: string;
  completed_at?: Date;
}
