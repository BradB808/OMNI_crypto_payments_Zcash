# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OMNI Crypto Payments is a Stripe-style payment infrastructure for privacy-preserving cryptocurrency. It enables merchants to accept Bitcoin and Zcash (including fully shielded transactions) through a simple API or Shopify integration. Upon payment confirmation, funds are automatically converted to stablecoins via Circle and settled to merchants in fiat, eliminating volatility risk and crypto complexity.

**Goal**: Make private, censorship-resistant payments as easy to accept as a credit card.

## Technology Stack

- **Backend**: Node.js/TypeScript with Express
- **Database**: PostgreSQL (ACID compliance for financial data)
- **Cache/Queue**: Redis + BullMQ (rate limiting, caching, job processing)
- **Blockchain**: Direct node connections (Bitcoin Core + Zcashd)
- **Conversion/Settlement**: Circle USDC infrastructure
- **Validation**: Zod (TypeScript-first schemas)
- **Logging**: Winston
- **Testing**: Jest + Supertest

## Common Commands

### Development Setup
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run db:migrate

# Generate wallet (first time only)
npm run wallet:setup

# Start development server
npm run dev

# Start all workers (separate terminal)
npm run workers:dev
```

### Development Workflow
```bash
# Run API server only
npm run dev:api

# Run specific worker
npm run dev:worker:bitcoin      # Bitcoin blockchain monitor
npm run dev:worker:zcash        # Zcash blockchain monitor
npm run dev:worker:conversion   # Conversion processor
npm run dev:worker:settlement   # Settlement processor
npm run dev:worker:webhook      # Webhook delivery

# Build TypeScript
npm run build

# Run built code
npm start
```

### Testing
```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Database Operations
```bash
# Create new migration
npm run db:migration:create <name>

# Run migrations
npm run db:migrate

# Rollback last migration
npm run db:migrate:rollback

# Seed database (development only)
npm run db:seed

# Reset database (WARNING: destroys data)
npm run db:reset
```

### Utilities
```bash
# Generate merchant API key
npm run generate:api-key

# Check blockchain node connections
npm run check:nodes

# Test Circle API connection
npm run check:circle

# View logs
npm run logs

# Lint code
npm run lint

# Format code
npm run format
```

## Architecture Overview

### System Architecture
```
Merchant API/Shopify → API Gateway → Core Services → Blockchain/Circle → Data Layer
```

**Core Services**:
- **Payment Service**: Payment lifecycle management, state machine
- **Blockchain Monitors**: Watch Bitcoin/Zcash nodes for incoming payments
- **Wallet Service**: HD wallet management, address generation, key encryption
- **Conversion Service**: Crypto → USDC via Circle, exchange rate caching
- **Settlement Service**: Batch merchant payouts, fiat transfers
- **Webhook Service**: Reliable event delivery to merchants

### Payment Flow
1. Merchant creates payment via API → receives unique crypto address
2. Customer sends BTC/ZEC to address
3. Blockchain Monitor detects payment → `payment.detected` webhook
4. After 6 confirmations → `payment.confirmed` webhook (merchant can fulfill order)
5. Conversion Service converts to USDC via Circle → `payment.converted` webhook
6. Settlement Service batches payments for periodic payout
7. Circle transfers fiat to merchant → `payment.settled` webhook

**Payment States**: `pending → detected → confirming → confirmed → converting → converted → settling → settled`

### Directory Structure

```
/src
  /api                    - API Gateway (Express server, routes, middleware)
  /services               - Business logic (payment, blockchain, wallet, etc.)
  /models                 - Data models (TypeScript interfaces)
  /database               - Migrations, repositories
  /workers                - Background processes (monitors, processors)
  /integrations           - External APIs (Circle, Shopify)
  /utils                  - Shared utilities
  /config                 - Configuration management
  /types                  - TypeScript type definitions

/shopify-app              - Shopify integration (separate app)
/tests                    - Unit, integration, E2E tests
/scripts                  - Utility scripts
/docker                   - Docker configurations
```

## Key Architectural Patterns

### 1. Modular Monolith
Services are cleanly separated but deployed together. Each service in `/services` has a single responsibility and can be extracted to a microservice later if needed.

### 2. Event-Driven Architecture
- Blockchain monitors emit events when payments are detected
- BullMQ queues handle async processing (conversions, webhooks, settlements)
- Redis pub/sub for inter-service communication

### 3. Repository Pattern
Database access is abstracted through repositories in `/database/repositories`. Never write raw SQL in services—always use repository methods.

### 4. State Machine for Payments
Payments follow a strict state machine (see `PaymentStateMachine.ts`). All state transitions are validated and logged for audit trail.

### 5. HD Wallet Strategy
- BIP32/BIP44 hierarchical deterministic wallets
- Bitcoin: `m/44'/0'/0'/0/{index}` (BIP84 native SegWit)
- Zcash: `m/44'/133'/0'/0/{index}` (Sapling shielded addresses)
- Master seed encrypted at rest, never exposed
- View keys stored separately from spending keys (Zcash)

## Critical Security Considerations

### Key Management
- **Master Seed**: Encrypted with AES-256 using key from `.env` (dev) or KMS (prod)
- **API Keys**: Hashed with bcrypt (12 rounds), never stored in plaintext
- **Webhook Secrets**: HMAC-SHA256 signatures for all webhook payloads
- **Zcash Shielded**: View keys for monitoring, spending keys in cold storage

### Hot/Cold Wallet Strategy
- **Hot Wallet**: Operational funds for immediate conversions
- **Cold Wallet**: Long-term secure storage
- **Automatic Sweeping**: When hot wallet exceeds threshold, sweep to cold storage

### API Security
- Rate limiting per merchant, per endpoint (Redis-based)
- Input validation on all endpoints (Zod schemas)
- SQL injection prevention (parameterized queries only)
- CORS configured per merchant's registered domains

### Financial Data Integrity
- PostgreSQL transactions for all financial operations
- Audit logging for all state changes
- Idempotency keys for all external API calls (Circle)
- Double-entry accounting for settlements

## Database Schema Highlights

### Core Tables
- **merchants**: Merchant accounts, API keys, webhook config, settlement preferences
- **payments**: Payment requests, amounts, addresses, status, timestamps
- **blockchain_transactions**: Raw blockchain data, confirmations, block info
- **conversions**: Crypto → USDC conversion records, rates, fees
- **settlements**: Batch payouts to merchants, Circle transfers
- **webhook_events**: Event delivery tracking, retry logic, status
- **wallet_addresses**: Generated addresses, derivation paths, usage tracking

### Important Indexes
- `payments.crypto_address` (for blockchain monitoring)
- `payments.status` (for querying by state)
- `payments.merchant_id + created_at` (for merchant dashboard)
- `webhook_events.status + next_retry_at` (for retry worker)

## Blockchain Integration

### Bitcoin Core (RPC + ZMQ)
- **Real-time Notifications**: ZMQ subscriptions for `hashblock` and `rawtx`
- **Address Generation**: BIP84 native SegWit (bech32) addresses
- **Confirmation Threshold**: 6 confirmations before conversion
- **Connection**: RPC authenticated with username/password from `.env`

### Zcashd (RPC Polling)
- **Polling Interval**: 15 seconds for new blocks
- **Shielded Support**: Sapling z-addresses with view key scanning
- **Monitoring**: `z_listreceivedbyaddress` with view keys
- **Memo Field**: Can contain order reference for reconciliation
- **Confirmation Threshold**: 6 confirmations (~7.5 minutes)

### Important Implementation Notes
1. **Never reuse addresses**: Each payment gets a unique address from HD wallet
2. **Confirmation tracking**: Update confirmation count on every new block
3. **Mempool detection**: Detect 0-conf payments but don't confirm until threshold
4. **Shielded transactions**: CPU-intensive view key scanning, runs in worker process
5. **Error handling**: Blockchain RPC can fail—implement exponential backoff

## Circle Integration

### Key Endpoints Used
- `GET /v1/exchange-rates`: Real-time crypto exchange rates (cached 30s)
- `POST /v1/crypto/accept`: Accept crypto payment, convert to USDC
- `POST /v1/payouts`: Transfer USDC to merchant bank account
- `GET /v1/balances`: Check USDC balance

### Webhook Events
- `crypto.received`: Circle received and confirmed crypto payment
- `payout.completed`: Fiat transfer to merchant completed
- `payout.failed`: Payout failed, retry or alert merchant

### Important Configuration
- Use **sandbox** environment during development (`CIRCLE_BASE_URL=https://api-sandbox.circle.com`)
- Store `CIRCLE_API_KEY` securely in `.env`, never commit
- Implement idempotency keys for all conversion requests
- Cache exchange rates to reduce API calls

## Shopify Integration

Located in `/shopify-app` (separate Node.js app).

### Components
1. **OAuth Flow**: Authenticate Shopify merchants
2. **Checkout Extension**: Add "Pay with Crypto" button to checkout
3. **Webhook Handlers**: Listen for OMNI payment events, mark Shopify orders as paid
4. **Admin Dashboard**: Show crypto payment stats in Shopify admin

### Payment Flow
1. Customer clicks "Pay with Crypto" → redirect to OMNI hosted payment page
2. Customer completes crypto payment
3. OMNI sends `payment.confirmed` webhook to Shopify app
4. Shopify app calls GraphQL API to mark order as paid
5. Merchant fulfills order normally

## Working with Workers

Workers are long-running background processes that handle:
- Blockchain monitoring (Bitcoin, Zcash)
- Conversion processing (BullMQ consumer)
- Settlement processing (cron-style scheduler)
- Webhook delivery (BullMQ consumer with retry logic)

### Running Workers in Development
Use PM2 ecosystem file for managing multiple workers:
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 logs            # View all logs
pm2 monit           # Monitor all processes
pm2 stop all        # Stop all workers
```

### Worker Implementation Pattern
```typescript
// Example: Conversion Worker
import { Worker } from 'bullmq';
import { conversionService } from '../services/conversion';

const worker = new Worker('conversions', async (job) => {
  const { paymentId, amount, currency } = job.data;
  await conversionService.convert(paymentId, amount, currency);
}, {
  connection: redisConnection,
  concurrency: 5
});

worker.on('completed', (job) => {
  logger.info(`Conversion completed: ${job.id}`);
});

worker.on('failed', (job, err) => {
  logger.error(`Conversion failed: ${job.id}`, err);
});
```

## Testing Guidelines

### Unit Tests
- Mock all external dependencies (database, Redis, blockchain RPC, Circle API)
- Test service logic in isolation
- Focus on business rules, state transitions, validation

### Integration Tests
- Use test database (automatically created/destroyed)
- Test repository methods with real PostgreSQL
- Test API endpoints with supertest
- Test worker queue processing

### E2E Tests
- Use testnet Bitcoin/Zcash nodes
- Use Circle sandbox API
- Test complete payment flow end-to-end
- Verify webhook delivery to test server

### Running Tests
Tests automatically:
- Create test database
- Run migrations
- Seed test data
- Clean up after completion

Never run tests against production database or mainnet blockchain nodes.

## Environment Variables

Required variables in `.env`:

### Critical for Security
- `MASTER_SEED_ENCRYPTION_KEY`: 32-byte hex for encrypting wallet seed
- `JWT_SECRET`: Secret for JWT tokens
- `WEBHOOK_SIGNING_SECRET`: Secret for HMAC webhook signatures
- `API_KEY_SALT_ROUNDS`: Bcrypt rounds for API keys (default: 12)

### Blockchain Nodes
- `BITCOIN_RPC_URL`, `BITCOIN_RPC_USER`, `BITCOIN_RPC_PASS`, `BITCOIN_ZMQ_ENDPOINT`
- `ZCASH_RPC_URL`, `ZCASH_RPC_USER`, `ZCASH_RPC_PASS`
- `BITCOIN_NETWORK`, `ZCASH_NETWORK`: `testnet` or `mainnet`

### Circle API
- `CIRCLE_API_KEY`: Circle API key
- `CIRCLE_ENTITY_ID`: Circle entity identifier
- `CIRCLE_BASE_URL`: Sandbox or production URL

### Application Config
- `PAYMENT_EXPIRATION_MINUTES`: Payment window (default: 15)
- `BTC_CONFIRMATION_THRESHOLD`: Required confirmations (default: 6)
- `ZEC_CONFIRMATION_THRESHOLD`: Required confirmations (default: 6)
- `SETTLEMENT_SCHEDULE`: `daily` or `weekly`
- `PLATFORM_FEE_PERCENT`: Platform fee percentage

See `.env.example` for complete list.

## Common Development Scenarios

### Adding a New Cryptocurrency

1. **Create Wallet Implementation**: `src/services/wallet/{Currency}Wallet.ts`
2. **Create Blockchain Monitor**: `src/services/blockchain/{Currency}Monitor.ts`
3. **Update Worker**: `src/workers/{currency}Monitor.ts`
4. **Update Models**: Add currency to `crypto_currency` enum
5. **Update Circle Integration**: Verify Circle supports the currency
6. **Migration**: Add to database enums
7. **Tests**: Full test coverage for new currency

### Adding a New Webhook Event

1. **Define Event Type**: Add to `webhook_events.event_type` enum
2. **Update WebhookService**: Add event creation method
3. **Update PaymentService**: Emit event at appropriate state transition
4. **Document**: Add to API documentation
5. **Test**: Verify webhook delivery and retry logic

### Modifying Payment State Machine

1. **Review Impact**: Payment states affect many services
2. **Update StateMachine**: Modify `PaymentStateMachine.ts`
3. **Update Database**: Add migration for new states
4. **Update All Services**: Payment, Webhook, Settlement services
5. **Audit Logging**: Ensure all state transitions logged
6. **Test Thoroughly**: State machine is mission-critical

### Debugging Payment Issues

1. **Check Logs**: Use Winston logs with correlation IDs
2. **Database State**: Query `payments` table for current status
3. **Blockchain Status**: Verify transaction on block explorer
4. **Worker Status**: Check worker logs for processing errors
5. **Circle Status**: Verify conversion status in Circle dashboard
6. **Webhook Delivery**: Check `webhook_events` table for delivery status

## Production Deployment Checklist

- [ ] All secrets in KMS or secure vault (not `.env`)
- [ ] Master seed encrypted with hardware security module
- [ ] Database backups configured and tested
- [ ] Redis persistence enabled
- [ ] Blockchain nodes synced and healthy
- [ ] Circle production API keys configured
- [ ] Rate limiting properly configured
- [ ] Monitoring and alerting set up (Prometheus/Grafana)
- [ ] Error tracking enabled (Sentry)
- [ ] Log aggregation configured
- [ ] Load balancer with TLS termination
- [ ] CORS configured per merchant
- [ ] Worker processes managed by orchestrator (K8s/PM2)
- [ ] Health check endpoints responding
- [ ] Database connection pooling optimized
- [ ] Hot wallet sweeping to cold storage working
- [ ] Audit logging enabled for all financial operations

## Troubleshooting

### "Cannot connect to Bitcoin/Zcash node"
- Verify node is running: `bitcoin-cli getblockchaininfo` or `zcash-cli getinfo`
- Check RPC credentials in `.env`
- Verify network (testnet vs mainnet)
- Check firewall rules

### "Payment stuck in 'detected' status"
- Check blockchain confirmations: may still be pending
- Verify blockchain monitor worker is running
- Check worker logs for errors
- Verify confirmation threshold configured correctly

### "Conversion failed"
- Check Circle API credentials
- Verify Circle sandbox vs production URL
- Check Circle balance (insufficient USDC?)
- Review Circle API error response in logs

### "Webhooks not delivering"
- Check webhook worker is running
- Verify merchant webhook URL is accessible
- Check `webhook_events` table for errors
- Test merchant endpoint manually with curl

## Additional Resources

- **Implementation Plan**: `/Users/brad/.claude/plans/sprightly-cuddling-sutton.md`
- **API Documentation**: `/docs/api.md` (once created)
- **Bitcoin RPC**: https://developer.bitcoin.org/reference/rpc/
- **Zcash RPC**: https://zcash.readthedocs.io/en/latest/rtd_pages/rpc.html
- **Circle API**: https://developers.circle.com/
- **Shopify API**: https://shopify.dev/docs/api

---

**Note**: This is a financial application handling real value. Always prioritize security, correctness, and auditability over speed of development. When in doubt, add more logging, more tests, and more validation.

**Note**: I have added a landing page to showcase the product this should not effect the underlying product we are building it is only to showcase the product to potential customers. 
