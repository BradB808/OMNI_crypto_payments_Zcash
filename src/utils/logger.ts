import winston from 'winston';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Logger configuration and setup using Winston
 * Provides structured logging with multiple transports
 */

// Ensure log directory exists
const logDir = process.env.LOG_FILE_PATH || './logs';
if (process.env.LOG_FILE_ENABLED === 'true' && !existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format (human-readable for development)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      // Filter out empty objects and stack traces for console
      const filteredMeta = { ...meta };
      delete filteredMeta.timestamp;
      if (Object.keys(filteredMeta).length > 0) {
        metaStr = '\n' + JSON.stringify(filteredMeta, null, 2);
      }
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Create transports
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.LOG_LEVEL || 'info',
  }),
];

// File transports (if enabled)
if (process.env.LOG_FILE_ENABLED === 'true') {
  transports.push(
    // Error log
    new winston.transports.File({
      filename: join(logDir, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: parseSize(process.env.LOG_MAX_SIZE || '10m'),
      maxFiles: parseMaxFiles(process.env.LOG_MAX_FILES || '14d'),
    }),
    // Combined log
    new winston.transports.File({
      filename: join(logDir, 'combined.log'),
      format: logFormat,
      maxsize: parseSize(process.env.LOG_MAX_SIZE || '10m'),
      maxFiles: parseMaxFiles(process.env.LOG_MAX_FILES || '14d'),
    })
  );
}

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  exitOnError: false,
});

// Helper: Parse size string (e.g., "10m" -> 10485760)
function parseSize(sizeStr: string): number {
  const units: { [key: string]: number } = {
    k: 1024,
    m: 1024 * 1024,
    g: 1024 * 1024 * 1024,
  };

  const match = sizeStr.match(/^(\d+)([kmg])?$/i);
  if (!match) {
    return 10 * 1024 * 1024; // Default 10MB
  }

  const value = parseInt(match[1]);
  const unit = match[2]?.toLowerCase() || '';
  return value * (units[unit] || 1);
}

// Helper: Parse max files string (e.g., "14d" -> 14)
function parseMaxFiles(maxFilesStr: string): number {
  const match = maxFilesStr.match(/^(\d+)d?$/i);
  if (!match) {
    return 14; // Default 14 days
  }
  return parseInt(match[1]);
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: object) {
  return logger.child(context);
}

/**
 * Log with correlation ID for request tracking
 */
export function logWithCorrelationId(correlationId: string, level: string, message: string, meta?: object) {
  logger.log(level, message, { correlationId, ...meta });
}

// Handle unhandled rejections and exceptions
if (process.env.NODE_ENV === 'production') {
  logger.exceptions.handle(
    new winston.transports.File({
      filename: join(logDir, 'exceptions.log'),
      format: logFormat,
    })
  );

  logger.rejections.handle(
    new winston.transports.File({
      filename: join(logDir, 'rejections.log'),
      format: logFormat,
    })
  );
}

// Export types
export type Logger = winston.Logger;
