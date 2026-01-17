import Decimal from 'decimal.js';

/**
 * Decimal Utility Functions
 * Wrapper around decimal.js for high-precision financial calculations
 *
 * CRITICAL: Always use these functions for money calculations to avoid
 * floating point precision errors (e.g., 0.1 + 0.2 = 0.30000000000000004)
 */

// Configure Decimal.js for financial precision
Decimal.set({
  precision: 20, // 20 significant digits
  rounding: Decimal.ROUND_HALF_UP, // Standard rounding
  toExpNeg: -7, // Avoid scientific notation for small numbers
  toExpPos: 20, // Avoid scientific notation for large numbers
});

/**
 * Add two decimal values
 */
export function add(a: string | number, b: string | number): string {
  return new Decimal(a).plus(b).toString();
}

/**
 * Subtract two decimal values (a - b)
 */
export function subtract(a: string | number, b: string | number): string {
  return new Decimal(a).minus(b).toString();
}

/**
 * Multiply two decimal values
 */
export function multiply(a: string | number, b: string | number): string {
  return new Decimal(a).times(b).toString();
}

/**
 * Divide two decimal values (a / b)
 */
export function divide(a: string | number, b: string | number): string {
  return new Decimal(a).dividedBy(b).toString();
}

/**
 * Compare two decimal values
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compare(a: string | number, b: string | number): number {
  return new Decimal(a).comparedTo(b);
}

/**
 * Check if two decimal values are equal
 */
export function equals(a: string | number, b: string | number): boolean {
  return new Decimal(a).equals(b);
}

/**
 * Check if a is greater than b
 */
export function greaterThan(a: string | number, b: string | number): boolean {
  return new Decimal(a).greaterThan(b);
}

/**
 * Check if a is greater than or equal to b
 */
export function greaterThanOrEqual(a: string | number, b: string | number): boolean {
  return new Decimal(a).greaterThanOrEqualTo(b);
}

/**
 * Check if a is less than b
 */
export function lessThan(a: string | number, b: string | number): boolean {
  return new Decimal(a).lessThan(b);
}

/**
 * Check if a is less than or equal to b
 */
export function lessThanOrEqual(a: string | number, b: string | number): boolean {
  return new Decimal(a).lessThanOrEqualTo(b);
}

/**
 * Round to specified decimal places
 */
export function round(value: string | number, decimalPlaces: number): string {
  return new Decimal(value).toDecimalPlaces(decimalPlaces).toString();
}

/**
 * Get absolute value
 */
export function abs(value: string | number): string {
  return new Decimal(value).abs().toString();
}

/**
 * Get maximum of multiple values
 */
export function max(...values: (string | number)[]): string {
  return Decimal.max(...values).toString();
}

/**
 * Get minimum of multiple values
 */
export function min(...values: (string | number)[]): string {
  return Decimal.min(...values).toString();
}

/**
 * Sum an array of decimal values
 */
export function sum(values: (string | number)[]): string {
  return values.reduce((acc, val) => add(acc, val), '0');
}

/**
 * Convert decimal string to number (use with caution - may lose precision)
 */
export function toNumber(value: string): number {
  return new Decimal(value).toNumber();
}

/**
 * Convert number to decimal string
 */
export function fromNumber(value: number): string {
  return new Decimal(value).toString();
}

/**
 * Parse and validate decimal string
 */
export function fromString(value: string): string {
  try {
    return new Decimal(value).toString();
  } catch (error) {
    throw new Error(`Invalid decimal string: ${value}`);
  }
}

/**
 * Format decimal for display with fixed decimal places
 */
export function toFixed(value: string | number, decimalPlaces: number): string {
  return new Decimal(value).toFixed(decimalPlaces);
}

/**
 * Check if value is zero
 */
export function isZero(value: string | number): boolean {
  return new Decimal(value).isZero();
}

/**
 * Check if value is positive
 */
export function isPositive(value: string | number): boolean {
  return new Decimal(value).isPositive();
}

/**
 * Check if value is negative
 */
export function isNegative(value: string | number): boolean {
  return new Decimal(value).isNegative();
}

/**
 * Calculate percentage (value * percentage / 100)
 * Example: percentage('100', '2.5') = '2.5' (2.5% of 100)
 */
export function percentage(value: string | number, percent: string | number): string {
  return divide(multiply(value, percent), 100);
}

/**
 * Create a Decimal instance (for advanced operations)
 */
export function createDecimal(value: string | number): Decimal {
  return new Decimal(value);
}
