# OMNI Crypto Payments

A Stripe-style payment infrastructure for privacy-preserving cryptocurrency, enabling online merchants to accept Bitcoin and Zcash—including fully shielded transactions—through a simple API or Shopify integration.

## 🎯 Overview

OMNI Crypto Payments makes private, censorship-resistant payments as easy to accept as a credit card. Upon payment confirmation, funds are automatically converted to stablecoins via Circle and settled to merchants in fiat, eliminating volatility risk and crypto complexity.

### Key Features

- **Multiple Cryptocurrencies**: Accept Bitcoin and Zcash (including shielded transactions)
- **Privacy-Preserving**: Full support for Zcash shielded transactions
- **Automatic Conversion**: Instant conversion to USDC via Circle
- **Fiat Settlement**: Automated batch payouts to merchant bank accounts
- **Simple Integration**: REST API and Shopify plugin
- **No Volatility Risk**: Merchants never hold crypto
- **Enterprise-Grade Security**: HD wallets, encrypted keys, comprehensive audit logging

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 13
- Redis >= 6
- Bitcoin Core (for Bitcoin support)
- Zcashd (for Zcash support)
- Circle API account

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd omni-crypto-payments

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run db:migrate

# Generate wallet (first time only)
npm run wallet:setup
```

### Development

```bash
# Start API server
npm run dev

# Start all workers (separate terminal)
npm run workers:dev

# Or start specific workers
npm run dev:worker:bitcoin
npm run dev:worker:zcash
npm run dev:worker:conversion
```

### Production

```bash
# Build TypeScript
npm run build

# Start API server
npm start

# Start workers
npm run start:worker:bitcoin
npm run start:worker:zcash
npm run start:worker:conversion
npm run start:worker:settlement
npm run start:worker:webhook
```

## 📋 Project Status

**Current Phase**: Phase 1 - Foundation (COMPLETED)

### ✅ Phase 1 Completed
- [x] Project configuration (TypeScript, package.json, tsconfig)
- [x] Environment configuration (.env.example with 60+ variables)
- [x] Database schema (9 core tables with indexes and triggers)
- [x] Database connection and pool management
- [x] Configuration management with Zod validation
- [x] Logging system (Winston with file and console transports)
- [x] Error handling (20+ custom error classes)
- [x] Core TypeScript models (Merchant, Payment, Settlement, etc.)
- [x] Repository pattern (MerchantRepository example)
- [x] Utility functions (crypto, validation)

### 🎯 Next Steps (Phase 2 - Wallet Service)
- [ ] HD wallet implementation (BIP32/BIP44)
- [ ] Bitcoin address generation (BIP84 native SegWit)
- [ ] Zcash address generation (transparent + shielded Sapling)
- [ ] Key management and encryption
- [ ] Wallet setup script

See [CLAUDE.md](./CLAUDE.md) for detailed development guidance.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│  Merchant API / Shopify Integration         │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  API Gateway (Auth, Rate Limit, Validation) │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  Core Services                              │
│  • Payment Service (lifecycle management)   │
│  • Blockchain Monitors (BTC/ZEC watchers)   │
│  • Wallet Service (HD wallet, addresses)    │
│  • Conversion Service (Circle integration)  │
│  • Settlement Service (batch payouts)       │
│  • Webhook Service (reliable delivery)      │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  External Integrations                      │
│  • Bitcoin Core (direct RPC + ZMQ)          │
│  • Zcashd (direct RPC, view key scanning)   │
│  • Circle API (USDC conversion, payouts)    │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  Data Layer                                 │
│  • PostgreSQL (financial data, ACID)        │
│  • Redis (caching, rate limiting, sessions) │
│  • BullMQ (job queues, async processing)    │
└─────────────────────────────────────────────┘
```

## 💳 Payment Flow

1. **Merchant creates payment** → API returns unique crypto address + QR code
2. **Customer sends BTC/ZEC** → Blockchain monitor detects payment
3. **Payment detected** → Webhook: `payment.detected` sent to merchant
4. **Confirmations tracked** → 6 confirmations for BTC/ZEC
5. **Payment confirmed** → Webhook: `payment.confirmed` (merchant can fulfill order)
6. **Auto-conversion** → Circle converts crypto → USDC
7. **Batch settlement** → Daily/weekly payout to merchant bank
8. **Fiat received** → Webhook: `payment.settled`

**Payment States**: `pending → detected → confirming → confirmed → converting → converted → settling → settled`

## 🔐 Security Features

### Key Management
- **HD Wallets**: BIP32/BIP44 hierarchical deterministic wallets
- **Encrypted Seeds**: Master seed encrypted with AES-256-GCM
- **Separate Keys**: View keys for monitoring, spending keys in cold storage (Zcash)
- **Hot/Cold Strategy**: Operational hot wallet + secure cold storage

### API Security
- **API Key Hashing**: bcrypt with 12 rounds, never stored plaintext
- **Rate Limiting**: Per merchant, per endpoint (Redis-based)
- **Input Validation**: Zod schemas on all endpoints
- **Webhook Signatures**: HMAC-SHA256 signing
- **CORS**: Configurable per merchant domain

### Infrastructure
- **Database**: Encrypted at rest, TLS connections
- **Audit Logging**: Complete trail of all financial operations
- **Error Sanitization**: Sensitive data removed from logs
- **Secrets Management**: .env for dev, KMS for production

## 📊 Database Schema

### Core Tables
- **merchants**: Merchant accounts, API keys, webhook config
- **payments**: Payment requests, status, amounts, timestamps
- **blockchain_transactions**: Raw blockchain data, confirmations
- **conversions**: Crypto → USDC conversion records
- **settlements**: Batch payouts to merchants
- **webhook_events**: Event delivery tracking with retry logic
- **wallet_addresses**: Generated addresses, derivation paths
- **audit_logs**: Complete audit trail
- **exchange_rates**: Cached exchange rates

See [src/database/migrations/001_initial_schema.sql](src/database/migrations/001_initial_schema.sql) for complete schema.

## 🔧 Configuration

### Required Environment Variables

**Critical for Security**:
- `MASTER_SEED_ENCRYPTION_KEY`: 32-byte hex for wallet encryption
- `JWT_SECRET`: JWT signing secret (min 32 chars)
- `WEBHOOK_SIGNING_SECRET`: Webhook HMAC secret (min 32 chars)

**Blockchain Nodes**:
- `BITCOIN_RPC_URL`, `BITCOIN_RPC_USER`, `BITCOIN_RPC_PASS`
- `ZCASH_RPC_URL`, `ZCASH_RPC_USER`, `ZCASH_RPC_PASS`

**Circle API**:
- `CIRCLE_API_KEY`: Circle API key
- `CIRCLE_ENTITY_ID`: Circle entity identifier
- `CIRCLE_BASE_URL`: Sandbox or production URL

See [.env.example](.env.example) for complete configuration.

## 🧪 Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 📝 API Documentation

### Create Payment

```http
POST /v1/payments
Authorization: Bearer sk_live_...
Content-Type: application/json

{
  "order_id": "order_123",
  "amount": 99.99,
  "currency": "USD",
  "crypto_currency": "BTC",
  "description": "Premium Widget"
}
```

### Response

```json
{
  "id": "pay_abc123",
  "status": "pending",
  "crypto_address": "bc1q...",
  "crypto_amount": "0.00234567",
  "qr_code_url": "https://api.omni.com/v1/payments/pay_abc123/qr",
  "expires_at": "2026-01-12T19:30:00Z"
}
```

## 🛠️ Development Commands

```bash
# Code quality
npm run lint              # Lint TypeScript
npm run format            # Format code with Prettier
npm run typecheck         # Check TypeScript types

# Database
npm run db:migrate        # Run migrations
npm run db:migrate:rollback  # Rollback last migration
npm run db:seed           # Seed test data
npm run db:reset          # Reset database (WARNING: destroys data)

# Utilities
npm run generate:api-key  # Generate merchant API key
npm run check:nodes       # Check blockchain node connections
npm run check:circle      # Test Circle API connection
```

## 📖 Documentation

- [CLAUDE.md](./CLAUDE.md) - Comprehensive development guide for Claude Code
- [Implementation Plan](./plans/) - Detailed 10-phase implementation plan
- [API Documentation](#) - Full API reference (coming in Phase 5)

## 🤝 Contributing

This is currently a private project. For questions or issues, please contact the development team.

## 📄 License

MIT License - See LICENSE file for details

## 🔗 Resources

- **Bitcoin RPC**: https://developer.bitcoin.org/reference/rpc/
- **Zcash RPC**: https://zcash.readthedocs.io/en/latest/rtd_pages/rpc.html
- **Circle API**: https://developers.circle.com/
- **Shopify API**: https://shopify.dev/docs/api

---

**Note**: This is a financial application handling real value. Always prioritize security, correctness, and auditability over speed of development.
