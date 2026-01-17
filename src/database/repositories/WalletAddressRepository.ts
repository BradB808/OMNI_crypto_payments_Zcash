import { database, PoolClient } from '../connection';
import { WalletAddress, CreateWalletAddressInput, UpdateWalletAddressInput, WalletAddressPoolStats } from '../../models/WalletAddress';
import { CryptoCurrency, AddressType } from '../../types';
import { NotFoundError, DatabaseError } from '../../utils/errors';
import { logger } from '../../utils/logger';

/**
 * WalletAddress Repository
 * Data access layer for wallet address operations
 */
export class WalletAddressRepository {
  /**
   * Create a new wallet address
   */
  async create(input: CreateWalletAddressInput, client?: PoolClient): Promise<WalletAddress> {
    const query = `
      INSERT INTO wallet_addresses (
        crypto_currency, address, address_type, derivation_path, view_key, view_key_iv, view_key_auth_tag
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      input.crypto_currency,
      input.address,
      input.address_type,
      input.derivation_path,
      input.view_key || null,
      input.view_key_iv || null,
      input.view_key_auth_tag || null,
    ];

    try {
      const executor = client || database;
      const result = await executor.query<WalletAddress>(query, values);
      logger.debug('Wallet address created', {
        currency: input.crypto_currency,
        addressType: input.address_type,
      });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create wallet address', { error });
      throw new DatabaseError('Failed to create wallet address', { error });
    }
  }

  /**
   * Create multiple wallet addresses in a batch
   */
  async createBatch(inputs: CreateWalletAddressInput[], client?: PoolClient): Promise<WalletAddress[]> {
    if (inputs.length === 0) {
      return [];
    }

    // Build bulk insert query
    const values: any[] = [];
    const placeholders: string[] = [];

    inputs.forEach((input, i) => {
      const offset = i * 7;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`);
      values.push(
        input.crypto_currency,
        input.address,
        input.address_type,
        input.derivation_path,
        input.view_key || null,
        input.view_key_iv || null,
        input.view_key_auth_tag || null
      );
    });

    const query = `
      INSERT INTO wallet_addresses (
        crypto_currency, address, address_type, derivation_path, view_key, view_key_iv, view_key_auth_tag
      )
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    try {
      const executor = client || database;
      const result = await executor.query<WalletAddress>(query, values);
      logger.info('Wallet address batch created', { count: inputs.length });
      return result.rows;
    } catch (error) {
      logger.error('Failed to create wallet address batch', { error });
      throw new DatabaseError('Failed to create wallet address batch', { error });
    }
  }

  /**
   * Find wallet address by address string
   */
  async findByAddress(address: string): Promise<WalletAddress | null> {
    const query = 'SELECT * FROM wallet_addresses WHERE address = $1';

    try {
      const result = await database.query<WalletAddress>(query, [address]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find wallet address', { address, error });
      throw new DatabaseError('Failed to find wallet address', { error });
    }
  }

  /**
   * Find wallet address by ID
   */
  async findById(id: string): Promise<WalletAddress | null> {
    const query = 'SELECT * FROM wallet_addresses WHERE id = $1';

    try {
      const result = await database.query<WalletAddress>(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find wallet address by ID', { id, error });
      throw new DatabaseError('Failed to find wallet address', { error });
    }
  }

  /**
   * Get next available (unused) address for a currency
   */
  async getNextAvailableAddress(
    currency: CryptoCurrency,
    addressType: AddressType = 'transparent'
  ): Promise<WalletAddress | null> {
    const query = `
      SELECT * FROM wallet_addresses
      WHERE crypto_currency = $1
        AND address_type = $2
        AND is_used = FALSE
        AND payment_id IS NULL
      ORDER BY created_at ASC
      LIMIT 1
    `;

    try {
      const result = await database.query<WalletAddress>(query, [currency, addressType]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get next available address', { currency, addressType, error });
      throw new DatabaseError('Failed to get next available address', { error });
    }
  }

  /**
   * Mark address as used and assign to payment
   */
  async markAsUsed(addressId: string, paymentId: string): Promise<WalletAddress> {
    const query = `
      UPDATE wallet_addresses
      SET is_used = TRUE,
          used_at = NOW(),
          payment_id = $1
      WHERE id = $2
      RETURNING *
    `;

    try {
      const result = await database.query<WalletAddress>(query, [paymentId, addressId]);
      if (result.rows.length === 0) {
        throw new NotFoundError('WalletAddress', addressId);
      }
      logger.info('Wallet address marked as used', { addressId, paymentId });
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to mark address as used', { addressId, error });
      throw new DatabaseError('Failed to mark address as used', { error });
    }
  }

  /**
   * Update wallet address
   */
  async update(id: string, input: UpdateWalletAddressInput): Promise<WalletAddress> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.payment_id !== undefined) {
      fields.push(`payment_id = $${paramIndex++}`);
      values.push(input.payment_id);
    }
    if (input.is_used !== undefined) {
      fields.push(`is_used = $${paramIndex++}`);
      values.push(input.is_used);
    }
    if (input.used_at !== undefined) {
      fields.push(`used_at = $${paramIndex++}`);
      values.push(input.used_at);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    const query = `
      UPDATE wallet_addresses
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await database.query<WalletAddress>(query, values);
      if (result.rows.length === 0) {
        throw new NotFoundError('WalletAddress', id);
      }
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to update wallet address', { id, error });
      throw new DatabaseError('Failed to update wallet address', { error });
    }
  }

  /**
   * Get address pool statistics
   */
  async getPoolStats(
    currency: CryptoCurrency,
    addressType: AddressType = 'transparent'
  ): Promise<WalletAddressPoolStats> {
    const query = `
      SELECT
        crypto_currency,
        address_type,
        COUNT(*) as total_addresses,
        SUM(CASE WHEN is_used = TRUE THEN 1 ELSE 0 END) as used_addresses,
        SUM(CASE WHEN is_used = FALSE THEN 1 ELSE 0 END) as available_addresses
      FROM wallet_addresses
      WHERE crypto_currency = $1 AND address_type = $2
      GROUP BY crypto_currency, address_type
    `;

    try {
      const result = await database.query(query, [currency, addressType]);

      if (result.rows.length === 0) {
        return {
          crypto_currency: currency,
          address_type: addressType,
          total_addresses: 0,
          used_addresses: 0,
          available_addresses: 0,
        };
      }

      const row = result.rows[0];
      return {
        crypto_currency: row.crypto_currency,
        address_type: row.address_type,
        total_addresses: parseInt(row.total_addresses),
        used_addresses: parseInt(row.used_addresses),
        available_addresses: parseInt(row.available_addresses),
      };
    } catch (error) {
      logger.error('Failed to get pool stats', { currency, addressType, error });
      throw new DatabaseError('Failed to get pool stats', { error });
    }
  }

  /**
   * List all addresses for a currency
   */
  async listByCurrency(
    currency: CryptoCurrency,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ addresses: WalletAddress[]; total: number }> {
    const countQuery = 'SELECT COUNT(*) FROM wallet_addresses WHERE crypto_currency = $1';
    const dataQuery = `
      SELECT * FROM wallet_addresses
      WHERE crypto_currency = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        database.query(countQuery, [currency]),
        database.query<WalletAddress>(dataQuery, [currency, limit, offset]),
      ]);

      return {
        addresses: dataResult.rows,
        total: parseInt(countResult.rows[0].count),
      };
    } catch (error) {
      logger.error('Failed to list addresses by currency', { currency, error });
      throw new DatabaseError('Failed to list addresses', { error });
    }
  }

  /**
   * Find addresses by payment ID
   */
  async findByPaymentId(paymentId: string): Promise<WalletAddress[]> {
    const query = 'SELECT * FROM wallet_addresses WHERE payment_id = $1';

    try {
      const result = await database.query<WalletAddress>(query, [paymentId]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to find addresses by payment ID', { paymentId, error });
      throw new DatabaseError('Failed to find addresses', { error });
    }
  }

  /**
   * Get unused addresses count
   */
  async getUnusedCount(currency: CryptoCurrency, addressType: AddressType = 'transparent'): Promise<number> {
    const query = `
      SELECT COUNT(*) FROM wallet_addresses
      WHERE crypto_currency = $1
        AND address_type = $2
        AND is_used = FALSE
    `;

    try {
      const result = await database.query(query, [currency, addressType]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Failed to get unused count', { currency, addressType, error });
      throw new DatabaseError('Failed to get unused count', { error });
    }
  }

  /**
   * Delete address (should rarely be used)
   */
  async delete(id: string): Promise<void> {
    const query = 'DELETE FROM wallet_addresses WHERE id = $1';

    try {
      const result = await database.query(query, [id]);
      if (result.rowCount === 0) {
        throw new NotFoundError('WalletAddress', id);
      }
      logger.info('Wallet address deleted', { id });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to delete wallet address', { id, error });
      throw new DatabaseError('Failed to delete wallet address', { error });
    }
  }
}

// Export singleton instance
export const walletAddressRepository = new WalletAddressRepository();
