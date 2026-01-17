import { ZcashMonitor } from '../services/blockchain/ZcashMonitor';
import { database } from '../database/connection';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * Zcash Monitor Worker
 *
 * Standalone process for monitoring Zcash blockchain
 * Detects incoming payments (transparent and shielded) and updates confirmation status
 *
 * Usage:
 *   npm run worker:zcash
 *   or
 *   node dist/workers/zcashMonitor.js
 */

let monitor: ZcashMonitor | null = null;
let isShuttingDown = false;

/**
 * Main worker function
 */
async function main() {
  logger.info('Starting Zcash monitor worker...');

  try {
    // Initialize database connection
    logger.info('Connecting to database...');
    await database.connect();
    logger.info('Database connected');

    // Create and initialize monitor
    monitor = new ZcashMonitor();
    await monitor.initialize();

    // Start monitoring
    await monitor.start();

    logger.info('Zcash monitor worker started successfully');
    logger.info('Monitoring for Zcash payments...', {
      confirmationThreshold: config.zecConfirmationThreshold,
      pollIntervalMs: config.zcashPollIntervalMs,
      rpcUrl: config.zcashRpcUrl,
    });

    // Keep process alive
    process.stdin.resume();
  } catch (error) {
    logger.error('Failed to start Zcash monitor worker', { error });
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string) {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress...');
    return;
  }

  isShuttingDown = true;
  logger.info(`${signal} received, shutting down gracefully...`);

  try {
    // Stop monitor
    if (monitor) {
      logger.info('Stopping Zcash monitor...');
      await monitor.stop();
      logger.info('Zcash monitor stopped');
    }

    // Disconnect database
    logger.info('Disconnecting from database...');
    await database.disconnect();
    logger.info('Database disconnected');

    logger.info('Zcash monitor worker shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

/**
 * Error handlers
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in Zcash monitor worker', { error });
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection in Zcash monitor worker', {
    reason,
    promise,
  });
  shutdown('UNHANDLED_REJECTION');
});

/**
 * Shutdown signal handlers
 */
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the worker
main();
