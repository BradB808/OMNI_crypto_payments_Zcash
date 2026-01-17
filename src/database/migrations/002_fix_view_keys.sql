-- =====================================================
-- OMNI Crypto Payments - Fix View Key Storage
-- Migration: 002_fix_view_keys
-- Description: Adds IV and auth tag columns for AES-256-GCM decryption
-- =====================================================

-- Add IV (initialization vector) column for view key decryption
ALTER TABLE wallet_addresses
ADD COLUMN view_key_iv TEXT;

-- Add authentication tag column for view key decryption
ALTER TABLE wallet_addresses
ADD COLUMN view_key_auth_tag TEXT;

-- Add comment explaining the encryption scheme
COMMENT ON COLUMN wallet_addresses.view_key IS 'Encrypted view key (AES-256-GCM ciphertext)';
COMMENT ON COLUMN wallet_addresses.view_key_iv IS 'Initialization vector for view key decryption';
COMMENT ON COLUMN wallet_addresses.view_key_auth_tag IS 'Authentication tag for view key decryption';

-- Add constraint: if view_key exists, iv and tag must also exist
ALTER TABLE wallet_addresses
ADD CONSTRAINT view_key_encryption_complete
CHECK (
  (view_key IS NULL AND view_key_iv IS NULL AND view_key_auth_tag IS NULL)
  OR
  (view_key IS NOT NULL AND view_key_iv IS NOT NULL AND view_key_auth_tag IS NOT NULL)
);
