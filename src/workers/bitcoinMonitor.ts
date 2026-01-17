import { BitcoinMonitor } from '../services/blockchain/BitcoinMonitor';
import { database } from '../database/connection';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * Bitcoin Monitor Worker
 *
 * Standalone process for monitoring Bitcoin blockchain
 * Detects incoming payments and updates confirmation status
 *
 * Usage:
 *   npm run worker:bitcoin
 *   or
 *   node dist/workers/bitcoinMonitor.js
 */

let monitor: BitcoinMonitor | null = null;
let isShuttingDown = false;

/**
 * Main worker function
 */
async function main() {
  logger.info('Starting Bitcoin monitor worker...');

  try {
    // Initialize database connection
    logger.info('Connecting to database...');
    await database.connect();
    logger.info('Database connected');

    // Create and initialize monitor
    monitor = new BitcoinMonitor();
    await monitor.initialize();

    // Start monitoring
    await monitor.start();

    logger.info('Bitcoin monitor worker started successfully');
    logger.info('Monitoring for Bitcoin payments...', {
      confirmationThreshold: config.btcConfirmationThreshold,
      zmqEndpoint: config.bitcoinZmqEndpoint,
      rpcUrl: config.bitcoinRpcUrl,
    });

    // Keep process alive
    process.stdin.resume();
  } catch (error) {
    logger.error('Failed to start Bitcoin monitor worker', { error });
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
      logger.info('Stopping Bitcoin monitor...');
      await monitor.stop();
      logger.info('Bitcoin monitor stopped');
    }

    // Disconnect database
    logger.info('Disconnecting from database...');
    await database.disconnect();
    logger.info('Database disconnected');

    logger.info('Bitcoin monitor worker shut down successfully');
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
  logger.error('Uncaught exception in Bitcoin monitor worker', { error });
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection in Bitcoin monitor worker', {
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
