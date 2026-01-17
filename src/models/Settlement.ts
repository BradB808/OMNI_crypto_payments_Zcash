import { SettlementStatus, FiatCurrency, Decimal } from '../types';

/**
 * Settlement model
 * Represents a batch payout to a merchant
 */
export interface Settlement {
  id: string;
  merchant_id: string;

  // Settlement details
  payment_count: number;
  total_amount: Decimal; // Stored as string for precision
  currency: FiatCurrency;
  fee: Decimal; // Stored as string for precision
  net_amount: Decimal; // Stored as string for precision

  // Circle transfer
  circle_transfer_id: string | null;

  // Status
  status: SettlementStatus;
  error_message: string | null;

  // Timestamps
  scheduled_at: Date;
  processed_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create settlement input
 */
export interface CreateSettlementInput {
  merchant_id: string;
  payment_count: number;
  total_amount: Decimal; // Stored as string for precision
  currency: FiatCurrency;
  fee: Decimal; // Stored as string for precision
  net_amount: Decimal; // Stored as string for precision
  scheduled_at: Date;
}

/**
 * Update settlement input
 */
export interface UpdateSettlementInput {
  status?: SettlementStatus;
  circle_transfer_id?: string;
  error_message?: string;
  processed_at?: Date;
  completed_at?: Date;
}

/**
 * Settlement with payment details
 */
export interface SettlementWithPayments extends Settlement {
  payments: Array<{
    id: string;
    order_id: string;
    amount: Decimal; // Stored as string for precision
  }>;
}
