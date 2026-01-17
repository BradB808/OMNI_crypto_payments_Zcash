import { z } from 'zod';
import { ValidationError } from './errors';
import * as decimal from './decimal';

/**
 * Validation utilities using Zod
 */

/**
 * Validate data against a Zod schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      throw new ValidationError('Validation failed', formattedErrors);
    }
    throw error;
  }
}

/**
 * Validate and return safe data (doesn't throw on validation errors)
 */
export function validateSafe<T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; errors?: any[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const formattedErrors = result.error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));

  return { success: false, errors: formattedErrors };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  uuid: z.string().uuid(),
  email: z.string().email(),
  url: z.string().url(),
  positiveNumber: z.number().positive(),
  positiveInteger: z.number().int().positive(),
  decimalString: z.string().regex(/^\d+(\.\d+)?$/),
  bitcoinAddress: z.string().regex(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/),
  zcashTransparentAddress: z.string().regex(/^t[a-zA-Z0-9]{34}$/),
  zcashShieldedAddress: z.string().regex(/^z[a-zA-Z0-9]{77}$/),
  txid: z.string().regex(/^[a-fA-F0-9]{64}$/),
};

/**
 * Validate Bitcoin address
 */
export function isValidBitcoinAddress(address: string): boolean {
  return commonSchemas.bitcoinAddress.safeParse(address).success;
}

/**
 * Validate Zcash address (transparent or shielded)
 */
export function isValidZcashAddress(address: string): boolean {
  return (
    commonSchemas.zcashTransparentAddress.safeParse(address).success ||
    commonSchemas.zcashShieldedAddress.safeParse(address).success
  );
}

/**
 * Validate transaction ID
 */
export function isValidTxid(txid: string): boolean {
  return commonSchemas.txid.safeParse(txid).success;
}

/**
 * Sanitize string input (remove dangerous characters)
 */
export function sanitizeString(input: string): string {
  return input.replace(/[<>\"\'&]/g, '');
}

/**
 * Validate and parse decimal string
 * Returns the validated decimal as a string to preserve precision
 */
export function parseDecimal(value: string): string {
  const result = commonSchemas.decimalString.safeParse(value);
  if (!result.success) {
    throw new ValidationError('Invalid decimal value');
  }
  return decimal.fromString(value);
}

/**
 * Format decimal to fixed precision
 */
export function formatDecimal(value: string, decimals: number = 8): string {
  return decimal.toFixed(value, decimals);
}

/**
 * Validate decimal precision (ensure it doesn't exceed max decimal places)
 */
export function validateDecimalPrecision(value: string, maxDecimals: number): boolean {
  const parts = value.split('.');
  if (parts.length === 1) return true; // No decimal places
  return parts[1].length <= maxDecimals;
}

/**
 * Validate amount within range
 * Works with decimal strings for precision
 */
export function validateAmount(amount: string, min: string, max: string): void {
  if (decimal.lessThan(amount, min) || decimal.greaterThan(amount, max)) {
    throw new ValidationError(`Amount must be between ${min} and ${max}`, { amount, min, max });
  }
}

/**
 * Validate pagination parameters
 */
export function validatePagination(limit?: number, offset?: number): { limit: number; offset: number } {
  const validatedLimit = limit && limit > 0 && limit <= 100 ? limit : 10;
  const validatedOffset = offset && offset >= 0 ? offset : 0;

  return { limit: validatedLimit, offset: validatedOffset };
}
