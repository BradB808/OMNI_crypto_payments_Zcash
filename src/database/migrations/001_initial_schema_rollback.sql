-- =====================================================
-- OMNI Crypto Payments - Rollback Initial Schema
-- Migration: 001_initial_schema_rollback
-- Description: Drops all tables created in 001_initial_schema
-- =====================================================

-- Drop tables in reverse order (respecting foreign keys)
DROP TABLE IF EXISTS exchange_rates CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS conversions CASCADE;
DROP TABLE IF EXISTS wallet_addresses CASCADE;
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS settlements CASCADE;
DROP TABLE IF EXISTS blockchain_transactions CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS merchants CASCADE;

-- Drop enums
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS crypto_currency CASCADE;
DROP TYPE IF EXISTS fiat_currency CASCADE;
DROP TYPE IF EXISTS merchant_status CASCADE;
DROP TYPE IF EXISTS settlement_schedule CASCADE;
DROP TYPE IF EXISTS settlement_status CASCADE;
DROP TYPE IF EXISTS webhook_event_type CASCADE;
DROP TYPE IF EXISTS webhook_status CASCADE;
DROP TYPE IF EXISTS conversion_status CASCADE;
DROP TYPE IF EXISTS address_type CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Note: We don't drop the uuid-ossp extension as it might be used by other databases
