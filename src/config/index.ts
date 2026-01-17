import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

/**
 * Configuration validation schema using Zod
 * Ensures all required environment variables are present and valid
 */
const configSchema = z.object({
  // Server
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().int().min(1).max(65535).default(3000),
  logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  apiBaseUrl: z.string().url().default('http://localhost:3000'),

  // Database
  databaseUrl: z.string().min(1),
  databaseSsl: z.coerce.boolean().default(false),
  databasePoolMin: z.coerce.number().int().min(1).default(2),
  databasePoolMax: z.coerce.number().int().min(1).default(10),

  // Redis
  redisUrl: z.string().min(1),
  redisPassword: z.string().optional(),
  redisDb: z.coerce.number().int().min(0).default(0),
  redisKeyPrefix: z.string().default('omni:'),

  // Bitcoin
  bitcoinRpcUrl: z.string().url(),
  bitcoinRpcUser: z.string().min(1),
  bitcoinRpcPass: z.string().min(1),
  bitcoinZmqEndpoint: z.string().min(1),
  bitcoinNetwork: z.enum(['mainnet', 'testnet', 'regtest']).default('testnet'),
  bitcoinPollIntervalMs: z.coerce.number().int().min(1000).default(10000),
  bitcoinMaxRetryAttempts: z.coerce.number().int().min(1).default(5),

  // Zcash
  zcashRpcUrl: z.string().url(),
  zcashRpcUser: z.string().min(1),
  zcashRpcPass: z.string().min(1),
  zcashNetwork: z.enum(['mainnet', 'testnet']).default('testnet'),
  zcashPollIntervalMs: z.coerce.number().int().min(1000).default(15000),
  zcashMaxRetryAttempts: z.coerce.number().int().min(1).default(5),

  // Circle
  circleApiKey: z.string().min(1),
  circleEntityId: z.string().min(1),
  circleBaseUrl: z.string().url().default('https://api-sandbox.circle.com'),
  circleApiVersion: z.string().default('v1'),
  circleRateLimitPerSecond: z.coerce.number().int().min(1).default(10),

  // Security
  masterSeedEncryptionKey: z.string().length(64), // 32 bytes in hex
  jwtSecret: z.string().min(32),
  jwtExpiresIn: z.string().default('7d'),
  apiKeySaltRounds: z.coerce.number().int().min(10).max(15).default(12),
  webhookSigningSecret: z.string().min(32),

  // AWS (optional, for production)
  awsRegion: z.string().optional(),
  awsAccessKeyId: z.string().optional(),
  awsSecretAccessKey: z.string().optional(),
  awsKmsKeyId: z.string().optional(),

  // Application
  paymentExpirationMinutes: z.coerce.number().int().min(5).max(60).default(15),
  minPaymentAmountUsd: z.coerce.number().min(0.01).default(1.0),
  maxPaymentAmountUsd: z.coerce.number().min(1).default(100000.0),
  btcConfirmationThreshold: z.coerce.number().int().min(1).default(6),
  zecConfirmationThreshold: z.coerce.number().int().min(1).default(6),
  settlementSchedule: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  settlementTime: z.string().default('00:00'),
  platformFeePercent: z.coerce.number().min(0).max(100).default(2.0),
  minSettlementAmountUsd: z.coerce.number().min(0).default(10.0),

  // Hot Wallet
  hotWalletMaxBalanceBtc: z.coerce.number().min(0).default(1.0),
  hotWalletMaxBalanceZec: z.coerce.number().min(0).default(50.0),
  hotWalletSweepThresholdBtc: z.coerce.number().min(0).default(0.5),
  hotWalletSweepThresholdZec: z.coerce.number().min(0).default(25.0),

  // Rate Limiting
  rateLimitWindowMs: z.coerce.number().int().min(1000).default(60000),
  rateLimitMaxRequests: z.coerce.number().int().min(1).default(100),
  rateLimitCreatePayment: z.coerce.number().int().min(1).default(100),
  rateLimitGetPayment: z.coerce.number().int().min(1).default(1000),

  // Webhook
  webhookMaxRetryAttempts: z.coerce.number().int().min(1).default(5),
  webhookRetryInitialDelayMs: z.coerce.number().int().min(100).default(1000),
  webhookRetryMaxDelayMs: z.coerce.number().int().min(1000).default(3600000),
  webhookTimeoutMs: z.coerce.number().int().min(1000).default(10000),

  // Workers
  bitcoinMonitorEnabled: z.coerce.boolean().default(true),
  bitcoinMonitorConcurrency: z.coerce.number().int().min(1).default(5),
  zcashMonitorEnabled: z.coerce.boolean().default(true),
  zcashMonitorConcurrency: z.coerce.number().int().min(1).default(3),
  conversionWorkerEnabled: z.coerce.boolean().default(true),
  conversionWorkerConcurrency: z.coerce.number().int().min(1).default(5),
  settlementWorkerEnabled: z.coerce.boolean().default(true),
  settlementWorkerConcurrency: z.coerce.number().int().min(1).default(2),
  webhookWorkerEnabled: z.coerce.boolean().default(true),
  webhookWorkerConcurrency: z.coerce.number().int().min(1).default(10),

  // Monitoring
  sentryDsn: z.string().optional(),
  sentryEnvironment: z.string().default('development'),
  logFileEnabled: z.coerce.boolean().default(true),
  logFilePath: z.string().default('./logs'),
  logMaxSize: z.string().default('10m'),
  logMaxFiles: z.string().default('14d'),
  metricsEnabled: z.coerce.boolean().default(false),
  metricsPort: z.coerce.number().int().min(1).max(65535).default(9090),

  // Testing
  testDatabaseUrl: z.string().optional(),
  testRedisUrl: z.string().optional(),
  devAutoConfirmPayments: z.coerce.boolean().default(false),
  devMockCircleApi: z.coerce.boolean().default(false),
  devMockBlockchainRpc: z.coerce.boolean().default(false),

  // CORS
  corsAllowedOrigins: z.string().default('http://localhost:3000'),
  corsCredentials: z.coerce.boolean().default(false), // Secure default: false to allow wildcard origins

  // Shopify (optional)
  shopifyAppEnabled: z.coerce.boolean().default(false),
  shopifyApiKey: z.string().optional(),
  shopifyApiSecret: z.string().optional(),
  shopifyScopes: z.string().default('write_orders,read_products'),
  shopifyAppUrl: z.string().url().optional(),
});

/**
 * Parse and validate configuration from environment variables
 */
function loadConfig() {
  const rawConfig = {
    // Server
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    logLevel: process.env.LOG_LEVEL,
    apiBaseUrl: process.env.API_BASE_URL,

    // Database
    databaseUrl: process.env.DATABASE_URL,
    databaseSsl: process.env.DATABASE_SSL,
    databasePoolMin: process.env.DATABASE_POOL_MIN,
    databasePoolMax: process.env.DATABASE_POOL_MAX,

    // Redis
    redisUrl: process.env.REDIS_URL,
    redisPassword: process.env.REDIS_PASSWORD,
    redisDb: process.env.REDIS_DB,
    redisKeyPrefix: process.env.REDIS_KEY_PREFIX,

    // Bitcoin
    bitcoinRpcUrl: process.env.BITCOIN_RPC_URL,
    bitcoinRpcUser: process.env.BITCOIN_RPC_USER,
    bitcoinRpcPass: process.env.BITCOIN_RPC_PASS,
    bitcoinZmqEndpoint: process.env.BITCOIN_ZMQ_ENDPOINT,
    bitcoinNetwork: process.env.BITCOIN_NETWORK,
    bitcoinPollIntervalMs: process.env.BITCOIN_POLL_INTERVAL_MS,
    bitcoinMaxRetryAttempts: process.env.BITCOIN_MAX_RETRY_ATTEMPTS,

    // Zcash
    zcashRpcUrl: process.env.ZCASH_RPC_URL,
    zcashRpcUser: process.env.ZCASH_RPC_USER,
    zcashRpcPass: process.env.ZCASH_RPC_PASS,
    zcashNetwork: process.env.ZCASH_NETWORK,
    zcashPollIntervalMs: process.env.ZCASH_POLL_INTERVAL_MS,
    zcashMaxRetryAttempts: process.env.ZCASH_MAX_RETRY_ATTEMPTS,

    // Circle
    circleApiKey: process.env.CIRCLE_API_KEY,
    circleEntityId: process.env.CIRCLE_ENTITY_ID,
    circleBaseUrl: process.env.CIRCLE_BASE_URL,
    circleApiVersion: process.env.CIRCLE_API_VERSION,
    circleRateLimitPerSecond: process.env.CIRCLE_RATE_LIMIT_PER_SECOND,

    // Security
    masterSeedEncryptionKey: process.env.MASTER_SEED_ENCRYPTION_KEY,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN,
    apiKeySaltRounds: process.env.API_KEY_SALT_ROUNDS,
    webhookSigningSecret: process.env.WEBHOOK_SIGNING_SECRET,

    // AWS
    awsRegion: process.env.AWS_REGION,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsKmsKeyId: process.env.AWS_KMS_KEY_ID,

    // Application
    paymentExpirationMinutes: process.env.PAYMENT_EXPIRATION_MINUTES,
    minPaymentAmountUsd: process.env.MIN_PAYMENT_AMOUNT_USD,
    maxPaymentAmountUsd: process.env.MAX_PAYMENT_AMOUNT_USD,
    btcConfirmationThreshold: process.env.BTC_CONFIRMATION_THRESHOLD,
    zecConfirmationThreshold: process.env.ZEC_CONFIRMATION_THRESHOLD,
    settlementSchedule: process.env.SETTLEMENT_SCHEDULE,
    settlementTime: process.env.SETTLEMENT_TIME,
    platformFeePercent: process.env.PLATFORM_FEE_PERCENT,
    minSettlementAmountUsd: process.env.MIN_SETTLEMENT_AMOUNT_USD,

    // Hot Wallet
    hotWalletMaxBalanceBtc: process.env.HOT_WALLET_MAX_BALANCE_BTC,
    hotWalletMaxBalanceZec: process.env.HOT_WALLET_MAX_BALANCE_ZEC,
    hotWalletSweepThresholdBtc: process.env.HOT_WALLET_SWEEP_THRESHOLD_BTC,
    hotWalletSweepThresholdZec: process.env.HOT_WALLET_SWEEP_THRESHOLD_ZEC,

    // Rate Limiting
    rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
    rateLimitCreatePayment: process.env.RATE_LIMIT_CREATE_PAYMENT,
    rateLimitGetPayment: process.env.RATE_LIMIT_GET_PAYMENT,

    // Webhook
    webhookMaxRetryAttempts: process.env.WEBHOOK_MAX_RETRY_ATTEMPTS,
    webhookRetryInitialDelayMs: process.env.WEBHOOK_RETRY_INITIAL_DELAY_MS,
    webhookRetryMaxDelayMs: process.env.WEBHOOK_RETRY_MAX_DELAY_MS,
    webhookTimeoutMs: process.env.WEBHOOK_TIMEOUT_MS,

    // Workers
    bitcoinMonitorEnabled: process.env.BITCOIN_MONITOR_ENABLED,
    bitcoinMonitorConcurrency: process.env.BITCOIN_MONITOR_CONCURRENCY,
    zcashMonitorEnabled: process.env.ZCASH_MONITOR_ENABLED,
    zcashMonitorConcurrency: process.env.ZCASH_MONITOR_CONCURRENCY,
    conversionWorkerEnabled: process.env.CONVERSION_WORKER_ENABLED,
    conversionWorkerConcurrency: process.env.CONVERSION_WORKER_CONCURRENCY,
    settlementWorkerEnabled: process.env.SETTLEMENT_WORKER_ENABLED,
    settlementWorkerConcurrency: process.env.SETTLEMENT_WORKER_CONCURRENCY,
    webhookWorkerEnabled: process.env.WEBHOOK_WORKER_ENABLED,
    webhookWorkerConcurrency: process.env.WEBHOOK_WORKER_CONCURRENCY,

    // Monitoring
    sentryDsn: process.env.SENTRY_DSN,
    sentryEnvironment: process.env.SENTRY_ENVIRONMENT,
    logFileEnabled: process.env.LOG_FILE_ENABLED,
    logFilePath: process.env.LOG_FILE_PATH,
    logMaxSize: process.env.LOG_MAX_SIZE,
    logMaxFiles: process.env.LOG_MAX_FILES,
    metricsEnabled: process.env.METRICS_ENABLED,
    metricsPort: process.env.METRICS_PORT,

    // Testing
    testDatabaseUrl: process.env.TEST_DATABASE_URL,
    testRedisUrl: process.env.TEST_REDIS_URL,
    devAutoConfirmPayments: process.env.DEV_AUTO_CONFIRM_PAYMENTS,
    devMockCircleApi: process.env.DEV_MOCK_CIRCLE_API,
    devMockBlockchainRpc: process.env.DEV_MOCK_BLOCKCHAIN_RPC,

    // CORS
    corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS,
    corsCredentials: process.env.CORS_CREDENTIALS,

    // Shopify
    shopifyAppEnabled: process.env.SHOPIFY_APP_ENABLED,
    shopifyApiKey: process.env.SHOPIFY_API_KEY,
    shopifyApiSecret: process.env.SHOPIFY_API_SECRET,
    shopifyScopes: process.env.SHOPIFY_SCOPES,
    shopifyAppUrl: process.env.SHOPIFY_APP_URL,
  };

  try {
    const parsedConfig = configSchema.parse(rawConfig);

    // Post-processing validation: CORS credentials with wildcard origin
    if (parsedConfig.corsAllowedOrigins.includes('*') && parsedConfig.corsCredentials) {
      console.warn('⚠️  CORS Warning: Wildcard origin (*) is incompatible with credentials=true. Forcing corsCredentials to false.');
      parsedConfig.corsCredentials = false;
    }

    return parsedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Configuration validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Invalid configuration. Check your environment variables.');
    }
    throw error;
  }
}

// Load and export configuration
export const config = loadConfig();

// Export type
export type Config = z.infer<typeof configSchema>;
