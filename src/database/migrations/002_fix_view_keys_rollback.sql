-- =====================================================
-- OMNI Crypto Payments - Rollback View Key Storage Fix
-- Migration Rollback: 002_fix_view_keys
-- Description: Removes IV and auth tag columns
-- =====================================================

-- Remove constraint
ALTER TABLE wallet_addresses
DROP CONSTRAINT IF EXISTS view_key_encryption_complete;

-- Remove auth tag column
ALTER TABLE wallet_addresses
DROP COLUMN IF EXISTS view_key_auth_tag;

-- Remove IV column
ALTER TABLE wallet_addresses
DROP COLUMN IF EXISTS view_key_iv;
