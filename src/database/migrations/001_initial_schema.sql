-- =====================================================
-- OMNI Crypto Payments - Initial Database Schema
-- Migration: 001_initial_schema
-- Description: Creates all core tables for the payment system
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE payment_status AS ENUM (
  'pending',
  'detected',
  'confirming',
  'confirmed',
  'converting',
  'converted',
  'settling',
  'settled',
  'expired',
  'failed'
);

CREATE TYPE crypto_currency AS ENUM (
  'BTC',
  'ZEC'
);

CREATE TYPE fiat_currency AS ENUM (
  'USD',
  'EUR',
  'GBP'
);

CREATE TYPE merchant_status AS ENUM (
  'active',
  'suspended',
  'closed'
);

CREATE TYPE settlement_schedule AS ENUM (
  'daily',
  'weekly',
  'monthly'
);

CREATE TYPE settlement_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);

CREATE TYPE webhook_event_type AS ENUM (
  'payment.detected',
  'payment.confirmed',
  'payment.converted',
  'payment.settled',
  'payment.expired',
  'payment.failed'
);

CREATE TYPE webhook_status AS ENUM (
  'pending',
  'delivered',
  'failed'
);

CREATE TYPE conversion_status AS ENUM (
  'pending',
  'completed',
  'failed'
);

CREATE TYPE address_type AS ENUM (
  'transparent',
  'shielded'
);

-- =====================================================
-- MERCHANTS TABLE
-- =====================================================

CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,

  -- API authentication
  api_key_hash VARCHAR(255) NOT NULL UNIQUE,

  -- Webhook configuration
  webhook_url TEXT,
  webhook_secret VARCHAR(255) NOT NULL,

  -- Settlement configuration
  settlement_currency fiat_currency NOT NULL DEFAULT 'USD',
  settlement_schedule settlement_schedule NOT NULL DEFAULT 'daily',
  settlement_account_id VARCHAR(255), -- Circle account ID

  -- Merchant status
  status merchant_status NOT NULL DEFAULT 'active',

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for merchants
CREATE INDEX idx_merchants_email ON merchants(email);
CREATE INDEX idx_merchants_status ON merchants(status);
CREATE INDEX idx_merchants_created_at ON merchants(created_at);

-- =====================================================
-- PAYMENTS TABLE
-- =====================================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Merchant-provided data
  order_id VARCHAR(255) NOT NULL,
  amount_fiat DECIMAL(20, 2) NOT NULL CHECK (amount_fiat > 0),
  currency fiat_currency NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',

  -- Merchant redirect URLs
  success_url TEXT,
  cancel_url TEXT,

  -- Crypto payment details
  crypto_currency crypto_currency NOT NULL,
  crypto_amount DECIMAL(20, 8) NOT NULL CHECK (crypto_amount > 0),
  crypto_address VARCHAR(255) NOT NULL,
  exchange_rate DECIMAL(20, 8) NOT NULL,

  -- Payment status
  status payment_status NOT NULL DEFAULT 'pending',

  -- Transaction tracking
  txid VARCHAR(255),
  confirmations INTEGER DEFAULT 0,
  detected_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE,

  -- Conversion tracking
  usdc_amount DECIMAL(20, 8),
  conversion_rate DECIMAL(20, 8),
  conversion_fee DECIMAL(20, 8),
  converted_at TIMESTAMP WITH TIME ZONE,

  -- Settlement tracking
  settlement_id UUID REFERENCES settlements(id) ON DELETE SET NULL,
  settled_at TIMESTAMP WITH TIME ZONE,

  -- Payment lifecycle
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for payments
CREATE INDEX idx_payments_merchant_id ON payments(merchant_id);
CREATE INDEX idx_payments_order_id ON payments(merchant_id, order_id);
CREATE INDEX idx_payments_crypto_address ON payments(crypto_address);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_txid ON payments(txid);
CREATE INDEX idx_payments_created_at ON payments(merchant_id, created_at DESC);
CREATE INDEX idx_payments_expires_at ON payments(expires_at) WHERE status = 'pending';
CREATE INDEX idx_payments_settlement_id ON payments(settlement_id);

-- =====================================================
-- BLOCKCHAIN TRANSACTIONS TABLE
-- =====================================================

CREATE TABLE blockchain_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,

  -- Transaction details
  crypto_currency crypto_currency NOT NULL,
  txid VARCHAR(255) NOT NULL,
  from_address VARCHAR(255),
  to_address VARCHAR(255) NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,

  -- Block information
  confirmations INTEGER DEFAULT 0,
  block_height INTEGER,
  block_hash VARCHAR(255),

  -- Zcash specific
  is_shielded BOOLEAN DEFAULT FALSE,
  memo TEXT,

  -- Timestamps
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(crypto_currency, txid, to_address)
);

-- Indexes for blockchain transactions
CREATE INDEX idx_blockchain_txs_payment_id ON blockchain_transactions(payment_id);
CREATE INDEX idx_blockchain_txs_txid ON blockchain_transactions(txid);
CREATE INDEX idx_blockchain_txs_to_address ON blockchain_transactions(to_address);
CREATE INDEX idx_blockchain_txs_confirmations ON blockchain_transactions(confirmations) WHERE confirmations < 6;

-- =====================================================
-- SETTLEMENTS TABLE
-- =====================================================

CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Settlement details
  payment_count INTEGER NOT NULL DEFAULT 0,
  total_amount DECIMAL(20, 2) NOT NULL,
  currency fiat_currency NOT NULL,
  fee DECIMAL(20, 2) NOT NULL DEFAULT 0,
  net_amount DECIMAL(20, 2) NOT NULL,

  -- Circle transfer
  circle_transfer_id VARCHAR(255),

  -- Status
  status settlement_status NOT NULL DEFAULT 'pending',
  error_message TEXT,

  -- Timestamps
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for settlements
CREATE INDEX idx_settlements_merchant_id ON settlements(merchant_id);
CREATE INDEX idx_settlements_status ON settlements(status);
CREATE INDEX idx_settlements_scheduled_at ON settlements(scheduled_at);
CREATE INDEX idx_settlements_created_at ON settlements(merchant_id, created_at DESC);

-- =====================================================
-- WEBHOOK EVENTS TABLE
-- =====================================================

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,

  -- Event details
  event_type webhook_event_type NOT NULL,
  payload JSONB NOT NULL,

  -- Delivery tracking
  status webhook_status NOT NULL DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,

  -- Response tracking
  response_status_code INTEGER,
  response_body TEXT,

  -- Timestamps
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for webhook events
CREATE INDEX idx_webhook_events_merchant_id ON webhook_events(merchant_id);
CREATE INDEX idx_webhook_events_payment_id ON webhook_events(payment_id);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_next_retry ON webhook_events(next_retry_at) WHERE status = 'pending';
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at DESC);

-- =====================================================
-- WALLET ADDRESSES TABLE
-- =====================================================

CREATE TABLE wallet_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Address details
  crypto_currency crypto_currency NOT NULL,
  address VARCHAR(255) NOT NULL UNIQUE,
  address_type address_type NOT NULL DEFAULT 'transparent',

  -- Derivation info
  derivation_path VARCHAR(255) NOT NULL,

  -- Usage tracking
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,

  -- Zcash specific (for shielded addresses)
  view_key TEXT, -- Encrypted view key

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for wallet addresses
CREATE INDEX idx_wallet_addresses_currency ON wallet_addresses(crypto_currency);
CREATE INDEX idx_wallet_addresses_is_used ON wallet_addresses(is_used, crypto_currency);
CREATE INDEX idx_wallet_addresses_payment_id ON wallet_addresses(payment_id);

-- =====================================================
-- CONVERSIONS TABLE
-- =====================================================

CREATE TABLE conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,

  -- Conversion details
  from_currency crypto_currency NOT NULL,
  from_amount DECIMAL(20, 8) NOT NULL,
  to_currency VARCHAR(10) NOT NULL DEFAULT 'USDC',
  to_amount DECIMAL(20, 8) NOT NULL,

  -- Rates and fees
  exchange_rate DECIMAL(20, 8) NOT NULL,
  fee DECIMAL(20, 8) NOT NULL DEFAULT 0,

  -- Circle integration
  circle_transaction_id VARCHAR(255),

  -- Status
  status conversion_status NOT NULL DEFAULT 'pending',
  error_message TEXT,

  -- Timestamps
  initiated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for conversions
CREATE INDEX idx_conversions_payment_id ON conversions(payment_id);
CREATE INDEX idx_conversions_status ON conversions(status);
CREATE INDEX idx_conversions_created_at ON conversions(created_at DESC);

-- =====================================================
-- AUDIT LOG TABLE
-- =====================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Entity tracking
  entity_type VARCHAR(50) NOT NULL, -- 'payment', 'merchant', 'settlement', etc.
  entity_id UUID NOT NULL,

  -- Action details
  action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'status_changed', etc.
  actor_type VARCHAR(50), -- 'system', 'merchant', 'admin', etc.
  actor_id UUID,

  -- Changes
  old_values JSONB,
  new_values JSONB,

  -- Context
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for audit logs
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =====================================================
-- EXCHANGE RATES CACHE TABLE
-- =====================================================

CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Rate details
  from_currency crypto_currency NOT NULL,
  to_currency fiat_currency NOT NULL,
  rate DECIMAL(20, 8) NOT NULL,

  -- Source
  source VARCHAR(50) NOT NULL DEFAULT 'circle', -- 'circle', 'coinbase', etc.

  -- Validity
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraint: one rate per currency pair
  UNIQUE(from_currency, to_currency, source)
);

-- Indexes for exchange rates
CREATE INDEX idx_exchange_rates_currencies ON exchange_rates(from_currency, to_currency);
CREATE INDEX idx_exchange_rates_valid_until ON exchange_rates(valid_until);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blockchain_transactions_updated_at BEFORE UPDATE ON blockchain_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settlements_updated_at BEFORE UPDATE ON settlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_events_updated_at BEFORE UPDATE ON webhook_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_addresses_updated_at BEFORE UPDATE ON wallet_addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversions_updated_at BEFORE UPDATE ON conversions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE merchants IS 'Merchant accounts that accept crypto payments';
COMMENT ON TABLE payments IS 'Individual payment requests from merchants';
COMMENT ON TABLE blockchain_transactions IS 'Raw blockchain transaction data';
COMMENT ON TABLE settlements IS 'Batch payouts to merchants';
COMMENT ON TABLE webhook_events IS 'Webhook delivery tracking';
COMMENT ON TABLE wallet_addresses IS 'Generated crypto addresses for payments';
COMMENT ON TABLE conversions IS 'Crypto to USDC conversion records';
COMMENT ON TABLE audit_logs IS 'Audit trail for all financial operations';
COMMENT ON TABLE exchange_rates IS 'Cached exchange rates';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
