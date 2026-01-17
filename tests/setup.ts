import dotenv from 'dotenv';
import { logger } from '../src/utils/logger';

/**
 * Jest global setup
 * Runs once before all tests
 */

// Load environment variables from .env file
dotenv.config();

// Set test environment
process.env.NODE_ENV = 'test';

// Set shorter timeouts for tests
jest.setTimeout(30000); // 30 seconds

// Suppress logger output during tests (unless explicitly needed)
if (!process.env.TEST_VERBOSE) {
  logger.transports.forEach((transport) => {
    transport.silent = true;
  });
}

// Global test helpers
global.sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Console helpers for integration test instructions
global.logTestInstructions = (title: string, steps: string[]) => {
  console.log(`\n=== ${title} ===`);
  steps.forEach((step, index) => {
    console.log(`${index + 1}. ${step}`);
  });
  console.log('==========================================\n');
};

// Declare global types
declare global {
  function sleep(ms: number): Promise<void>;
  function logTestInstructions(title: string, steps: string[]): void;
}

export {};
