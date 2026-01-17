import { database, PoolClient } from '../connection';
import { Merchant, MerchantInternal, CreateMerchantInput, UpdateMerchantInput } from '../../models/Merchant';
import { NotFoundError, DatabaseError } from '../../utils/errors';
import { logger } from '../../utils/logger';

/**
 * Merchant Repository
 * Data access layer for merchant operations
 */
export class MerchantRepository {
  /**
   * Sanitize merchant data by removing sensitive fields
   * This ensures api_key_hash and webhook_secret are never exposed
   */
  private sanitizeMerchant(merchant: MerchantInternal): Merchant {
    const { api_key_hash, webhook_secret, ...sanitized } = merchant;
    return sanitized as Merchant;
  }
  /**
   * Create a new merchant
   */
  async create(input: CreateMerchantInput & { api_key_hash: string; webhook_secret: string }, client?: PoolClient): Promise<Merchant> {
    const query = `
      INSERT INTO merchants (
        name, email, api_key_hash, webhook_url, webhook_secret,
        settlement_currency, settlement_schedule, settlement_account_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      input.name,
      input.email,
      input.api_key_hash,
      input.webhook_url || null,
      input.webhook_secret,
      input.settlement_currency || 'USD',
      input.settlement_schedule || 'daily',
      input.settlement_account_id || null,
      JSON.stringify(input.metadata || {}),
    ];

    try {
      const executor = client || database;
      const result = await executor.query<MerchantInternal>(query, values);
      logger.info('Merchant created', { merchantId: result.rows[0].id });
      return this.sanitizeMerchant(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create merchant', { error });
      throw new DatabaseError('Failed to create merchant', { error });
    }
  }

  /**
   * Find merchant by ID
   */
  async findById(id: string): Promise<Merchant | null> {
    const query = 'SELECT * FROM merchants WHERE id = $1';

    try {
      const result = await database.query<MerchantInternal>(query, [id]);
      return result.rows[0] ? this.sanitizeMerchant(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find merchant by ID', { id, error });
      throw new DatabaseError('Failed to find merchant', { error });
    }
  }

  /**
   * Find merchant by email
   */
  async findByEmail(email: string): Promise<Merchant | null> {
    const query = 'SELECT * FROM merchants WHERE email = $1';

    try {
      const result = await database.query<MerchantInternal>(query, [email]);
      return result.rows[0] ? this.sanitizeMerchant(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find merchant by email', { email, error });
      throw new DatabaseError('Failed to find merchant', { error });
    }
  }

  /**
   * Find merchant by API key hash (for authentication)
   * Returns MerchantInternal with sensitive fields for auth verification
   * IMPORTANT: Only use this for internal authentication, never expose result directly
   */
  async findByApiKeyHash(apiKeyHash: string): Promise<MerchantInternal | null> {
    const query = 'SELECT * FROM merchants WHERE api_key_hash = $1';

    try {
      const result = await database.query<MerchantInternal>(query, [apiKeyHash]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find merchant by API key', { error });
      throw new DatabaseError('Failed to find merchant', { error });
    }
  }

  /**
   * Update merchant
   */
  async update(id: string, input: UpdateMerchantInput): Promise<Merchant> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic UPDATE query
    if (input.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      values.push(input.email);
    }
    if (input.webhook_url !== undefined) {
      fields.push(`webhook_url = $${paramIndex++}`);
      values.push(input.webhook_url);
    }
    if (input.settlement_currency !== undefined) {
      fields.push(`settlement_currency = $${paramIndex++}`);
      values.push(input.settlement_currency);
    }
    if (input.settlement_schedule !== undefined) {
      fields.push(`settlement_schedule = $${paramIndex++}`);
      values.push(input.settlement_schedule);
    }
    if (input.settlement_account_id !== undefined) {
      fields.push(`settlement_account_id = $${paramIndex++}`);
      values.push(input.settlement_account_id);
    }
    if (input.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(input.metadata));
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    const query = `
      UPDATE merchants
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await database.query<MerchantInternal>(query, values);
      if (result.rows.length === 0) {
        throw new NotFoundError('Merchant', id);
      }
      logger.info('Merchant updated', { merchantId: id });
      return this.sanitizeMerchant(result.rows[0]);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to update merchant', { id, error });
      throw new DatabaseError('Failed to update merchant', { error });
    }
  }

  /**
   * Delete merchant (soft delete by setting status to 'closed')
   */
  async delete(id: string): Promise<void> {
    const query = `
      UPDATE merchants
      SET status = 'closed'
      WHERE id = $1
    `;

    try {
      const result = await database.query(query, [id]);
      if (result.rowCount === 0) {
        throw new NotFoundError('Merchant', id);
      }
      logger.info('Merchant deleted (soft)', { merchantId: id });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to delete merchant', { id, error });
      throw new DatabaseError('Failed to delete merchant', { error });
    }
  }

  /**
   * List all merchants with pagination
   */
  async list(limit: number = 10, offset: number = 0): Promise<{ merchants: Merchant[]; total: number }> {
    const countQuery = 'SELECT COUNT(*) FROM merchants WHERE status != \'closed\'';
    const dataQuery = `
      SELECT * FROM merchants
      WHERE status != 'closed'
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        database.query(countQuery),
        database.query<MerchantInternal>(dataQuery, [limit, offset]),
      ]);

      return {
        merchants: dataResult.rows.map(row => this.sanitizeMerchant(row)),
        total: parseInt(countResult.rows[0].count),
      };
    } catch (error) {
      logger.error('Failed to list merchants', { error });
      throw new DatabaseError('Failed to list merchants', { error });
    }
  }
}

// Export singleton instance
export const merchantRepository = new MerchantRepository();
