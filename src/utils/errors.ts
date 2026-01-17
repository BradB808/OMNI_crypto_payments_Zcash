/**
 * Custom error classes for the OMNI Crypto Payments system
 * Provides structured error handling with proper status codes and error types
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this);
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR', true);
  }
}

/**
 * Authorization error (403)
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR', true);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND', true);
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT', true, details);
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true);
  }
}

/**
 * Payment errors
 */
export class PaymentError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'PAYMENT_ERROR', true, details);
  }
}

export class PaymentExpiredError extends PaymentError {
  constructor(paymentId: string) {
    super(`Payment ${paymentId} has expired`, { paymentId });
    this.errorCode = 'PAYMENT_EXPIRED';
  }
}

export class PaymentAlreadyProcessedError extends PaymentError {
  constructor(paymentId: string) {
    super(`Payment ${paymentId} has already been processed`, { paymentId });
    this.errorCode = 'PAYMENT_ALREADY_PROCESSED';
  }
}

export class InsufficientPaymentError extends PaymentError {
  constructor(expected: number, received: number) {
    super('Insufficient payment amount', { expected, received });
    this.errorCode = 'INSUFFICIENT_PAYMENT';
  }
}

export class InvalidPaymentAmountError extends PaymentError {
  constructor(amount: number, min: number, max: number) {
    super(`Payment amount must be between ${min} and ${max}`, { amount, min, max });
    this.errorCode = 'INVALID_PAYMENT_AMOUNT';
  }
}

/**
 * Blockchain errors
 */
export class BlockchainError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'BLOCKCHAIN_ERROR', true, details);
  }
}

export class BlockchainConnectionError extends BlockchainError {
  constructor(blockchain: string, details?: any) {
    super(`Failed to connect to ${blockchain} node`, details);
    this.errorCode = 'BLOCKCHAIN_CONNECTION_ERROR';
  }
}

export class TransactionNotFoundError extends BlockchainError {
  constructor(txid: string) {
    super(`Transaction ${txid} not found on blockchain`, { txid });
    this.errorCode = 'TRANSACTION_NOT_FOUND';
  }
}

export class InsufficientConfirmationsError extends BlockchainError {
  constructor(current: number, required: number) {
    super(`Insufficient confirmations: ${current}/${required}`, { current, required });
    this.errorCode = 'INSUFFICIENT_CONFIRMATIONS';
  }
}

/**
 * Wallet errors
 */
export class WalletError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'WALLET_ERROR', true, details);
  }
}

export class WalletInitializationError extends WalletError {
  constructor(details?: any) {
    super('Failed to initialize wallet', details);
    this.errorCode = 'WALLET_INITIALIZATION_ERROR';
  }
}

export class AddressGenerationError extends WalletError {
  constructor(currency: string, details?: any) {
    super(`Failed to generate ${currency} address`, details);
    this.errorCode = 'ADDRESS_GENERATION_ERROR';
  }
}

export class KeyDecryptionError extends WalletError {
  constructor(details?: any) {
    super('Failed to decrypt encryption key', details);
    this.errorCode = 'KEY_DECRYPTION_ERROR';
  }
}

/**
 * Conversion errors
 */
export class ConversionError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'CONVERSION_ERROR', true, details);
  }
}

export class ExchangeRateError extends ConversionError {
  constructor(from: string, to: string, details?: any) {
    super(`Failed to fetch exchange rate for ${from}/${to}`, details);
    this.errorCode = 'EXCHANGE_RATE_ERROR';
  }
}

export class CircleApiError extends ConversionError {
  constructor(message: string, statusCode?: number, details?: any) {
    super(`Circle API error: ${message}`, details);
    this.errorCode = 'CIRCLE_API_ERROR';
    if (statusCode) {
      this.statusCode = statusCode;
    }
  }
}

/**
 * Settlement errors
 */
export class SettlementError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'SETTLEMENT_ERROR', true, details);
  }
}

export class InsufficientSettlementAmountError extends SettlementError {
  constructor(amount: number, minimum: number) {
    super(`Settlement amount ${amount} below minimum ${minimum}`, { amount, minimum });
    this.errorCode = 'INSUFFICIENT_SETTLEMENT_AMOUNT';
  }
}

/**
 * Webhook errors
 */
export class WebhookError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'WEBHOOK_ERROR', true, details);
  }
}

export class WebhookDeliveryError extends WebhookError {
  constructor(url: string, statusCode?: number, details?: any) {
    super(`Failed to deliver webhook to ${url}`, { ...details, statusCode });
    this.errorCode = 'WEBHOOK_DELIVERY_ERROR';
  }
}

export class InvalidWebhookSignatureError extends WebhookError {
  constructor() {
    super('Invalid webhook signature');
    this.errorCode = 'INVALID_WEBHOOK_SIGNATURE';
    this.statusCode = 401;
  }
}

/**
 * Database errors
 */
export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'DATABASE_ERROR', false, details);
  }
}

export class DatabaseConnectionError extends DatabaseError {
  constructor(details?: any) {
    super('Database connection failed', details);
    this.errorCode = 'DATABASE_CONNECTION_ERROR';
  }
}

export class QueryError extends DatabaseError {
  constructor(query: string, details?: any) {
    super('Database query failed', { ...details, query: query.substring(0, 100) });
    this.errorCode = 'QUERY_ERROR';
  }
}

/**
 * External service errors
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: any) {
    super(`${service} error: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', true, details);
  }
}

/**
 * Error response formatter for API
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    statusCode: number;
  };
}

export function formatErrorResponse(error: AppError): ErrorResponse {
  return {
    error: {
      code: error.errorCode,
      message: error.message,
      details: error.details,
      statusCode: error.statusCode,
    },
  };
}

/**
 * Check if error is operational (expected) or programming error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Sanitize error for logging (remove sensitive data)
 */
export function sanitizeError(error: any): any {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.errorCode,
      statusCode: error.statusCode,
      details: error.details,
      stack: error.stack,
    };
  }

  return {
    message: error.message || 'Unknown error',
    stack: error.stack,
  };
}
