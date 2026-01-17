import { database, PoolClient } from '../connection';
import { Payment, CreatePaymentInput, UpdatePaymentInput, PaymentFilters } from '../../models/Payment';
import { PaymentStatus, CryptoCurrency } from '../../types';
import { NotFoundError, DatabaseError } from '../../utils/errors';
import { logger } from '../../utils/logger';

/**
 * Payment Repository
 * Data access layer for payment operations
 */
export class PaymentRepository {
  /**
   * Create a new payment
   */
  async create(input: CreatePaymentInput, client?: PoolClient): Promise<Payment> {
    const query = `
      INSERT INTO payments (
        merchant_id, order_id, amount_fiat, currency, description, metadata,
        crypto_currency, crypto_address, success_url, cancel_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      input.merchant_id,
      input.order_id,
      input.amount_fiat,
      input.currency,
      input.description || null,
      JSON.stringify(input.metadata || {}),
      input.crypto_currency,
      '', // crypto_address will be set separately after address generation
      input.success_url || null,
      input.cancel_url || null,
    ];

    try {
      const executor = client || database;
      const result = await executor.query<Payment>(query, values);
      logger.info('Payment created', {
        paymentId: result.rows[0].id,
        merchantId: input.merchant_id,
        cryptoCurrency: input.crypto_currency,
      });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create payment', { error });
      throw new DatabaseError('Failed to create payment', { error });
    }
  }

  /**
   * Find payment by ID
   */
  async findById(id: string): Promise<Payment | null> {
    const query = 'SELECT * FROM payments WHERE id = $1';

    try {
      const result = await database.query<Payment>(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find payment by ID', { id, error });
      throw new DatabaseError('Failed to find payment', { error });
    }
  }

  /**
   * Find payment by crypto address
   * CRITICAL: Used by blockchain monitors to link transactions to payments
   */
  async findByCryptoAddress(address: string): Promise<Payment | null> {
    const query = 'SELECT * FROM payments WHERE crypto_address = $1';

    try {
      const result = await database.query<Payment>(query, [address]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find payment by crypto address', { address, error });
      throw new DatabaseError('Failed to find payment', { error });
    }
  }

  /**
   * Update payment status
   */
  async updateStatus(id: string, status: PaymentStatus, client?: PoolClient): Promise<Payment> {
    const query = `
      UPDATE payments
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    try {
      const executor = client || database;
      const result = await executor.query<Payment>(query, [status, id]);
      if (result.rows.length === 0) {
        throw new NotFoundError('Payment', id);
      }
      logger.info('Payment status updated', { paymentId: id, status });
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to update payment status', { id, status, error });
      throw new DatabaseError('Failed to update payment status', { error });
    }
  }

  /**
   * Increment payment confirmations
   */
  async incrementConfirmations(id: string, client?: PoolClient): Promise<Payment> {
    const query = `
      UPDATE payments
      SET confirmations = confirmations + 1, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    try {
      const executor = client || database;
      const result = await executor.query<Payment>(query, [id]);
      if (result.rows.length === 0) {
        throw new NotFoundError('Payment', id);
      }
      logger.debug('Payment confirmations incremented', {
        paymentId: id,
        confirmations: result.rows[0].confirmations,
      });
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to increment payment confirmations', { id, error });
      throw new DatabaseError('Failed to increment payment confirmations', { error });
    }
  }

  /**
   * Find payments by status
   * Used by monitors to find payments that need confirmation tracking
   */
  async findByStatus(statuses: PaymentStatus[]): Promise<Payment[]> {
    const query = `
      SELECT * FROM payments
      WHERE status = ANY($1)
      ORDER BY created_at DESC
    `;

    try {
      const result = await database.query<Payment>(query, [statuses]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to find payments by status', { statuses, error });
      throw new DatabaseError('Failed to find payments by status', { error });
    }
  }

  /**
   * Link transaction to payment
   */
  async linkTransaction(paymentId: string, txid: string, client?: PoolClient): Promise<Payment> {
    const query = `
      UPDATE payments
      SET txid = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    try {
      const executor = client || database;
      const result = await executor.query<Payment>(query, [txid, paymentId]);
      if (result.rows.length === 0) {
        throw new NotFoundError('Payment', paymentId);
      }
      logger.info('Transaction linked to payment', { paymentId, txid });
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to link transaction to payment', { paymentId, txid, error });
      throw new DatabaseError('Failed to link transaction to payment', { error });
    }
  }

  /**
   * Update payment (general update method)
   */
  async update(id: string, input: UpdatePaymentInput, client?: PoolClient): Promise<Payment> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic UPDATE query
    if (input.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.txid !== undefined) {
      fields.push(`txid = $${paramIndex++}`);
      values.push(input.txid);
    }
    if (input.confirmations !== undefined) {
      fields.push(`confirmations = $${paramIndex++}`);
      values.push(input.confirmations);
    }
    if (input.detected_at !== undefined) {
      fields.push(`detected_at = $${paramIndex++}`);
      values.push(input.detected_at);
    }
    if (input.confirmed_at !== undefined) {
      fields.push(`confirmed_at = $${paramIndex++}`);
      values.push(input.confirmed_at);
    }
    if (input.usdc_amount !== undefined) {
      fields.push(`usdc_amount = $${paramIndex++}`);
      values.push(input.usdc_amount);
    }
    if (input.conversion_rate !== undefined) {
      fields.push(`conversion_rate = $${paramIndex++}`);
      values.push(input.conversion_rate);
    }
    if (input.conversion_fee !== undefined) {
      fields.push(`conversion_fee = $${paramIndex++}`);
      values.push(input.conversion_fee);
    }
    if (input.converted_at !== undefined) {
      fields.push(`converted_at = $${paramIndex++}`);
      values.push(input.converted_at);
    }
    if (input.settlement_id !== undefined) {
      fields.push(`settlement_id = $${paramIndex++}`);
      values.push(input.settlement_id);
    }
    if (input.settled_at !== undefined) {
      fields.push(`settled_at = $${paramIndex++}`);
      values.push(input.settled_at);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE payments
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const executor = client || database;
      const result = await executor.query<Payment>(query, values);
      if (result.rows.length === 0) {
        throw new NotFoundError('Payment', id);
      }
      logger.info('Payment updated', { paymentId: id });
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to update payment', { id, error });
      throw new DatabaseError('Failed to update payment', { error });
    }
  }

  /**
   * List payments with filters
   */
  async list(filters: PaymentFilters, limit: number = 10, offset: number = 0): Promise<{ payments: Payment[]; total: number }> {
    const whereClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build WHERE clause based on filters
    if (filters.merchant_id) {
      whereClauses.push(`merchant_id = $${paramIndex++}`);
      values.push(filters.merchant_id);
    }
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        whereClauses.push(`status = ANY($${paramIndex++})`);
        values.push(filters.status);
      } else {
        whereClauses.push(`status = $${paramIndex++}`);
        values.push(filters.status);
      }
    }
    if (filters.crypto_currency) {
      whereClauses.push(`crypto_currency = $${paramIndex++}`);
      values.push(filters.crypto_currency);
    }
    if (filters.order_id) {
      whereClauses.push(`order_id = $${paramIndex++}`);
      values.push(filters.order_id);
    }
    if (filters.created_after) {
      whereClauses.push(`created_at >= $${paramIndex++}`);
      values.push(filters.created_after);
    }
    if (filters.created_before) {
      whereClauses.push(`created_at <= $${paramIndex++}`);
      values.push(filters.created_before);
    }
    if (filters.expires_after) {
      whereClauses.push(`expires_at >= $${paramIndex++}`);
      values.push(filters.expires_after);
    }
    if (filters.expires_before) {
      whereClauses.push(`expires_at <= $${paramIndex++}`);
      values.push(filters.expires_before);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM payments ${whereClause}`;
    const dataQuery = `
      SELECT * FROM payments
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    try {
      const countValues = [...values];
      const dataValues = [...values, limit, offset];

      const [countResult, dataResult] = await Promise.all([
        database.query(countQuery, countValues),
        database.query<Payment>(dataQuery, dataValues),
      ]);

      return {
        payments: dataResult.rows,
        total: parseInt(countResult.rows[0].count),
      };
    } catch (error) {
      logger.error('Failed to list payments', { filters, error });
      throw new DatabaseError('Failed to list payments', { error });
    }
  }

  /**
   * Find expired payments
   * Used by background workers to mark payments as expired
   */
  async findExpired(): Promise<Payment[]> {
    const query = `
      SELECT * FROM payments
      WHERE status = 'pending'
        AND expires_at < NOW()
      ORDER BY expires_at ASC
    `;

    try {
      const result = await database.query<Payment>(query);
      return result.rows;
    } catch (error) {
      logger.error('Failed to find expired payments', { error });
      throw new DatabaseError('Failed to find expired payments', { error });
    }
  }

  /**
   * Set crypto address for payment (after address generation)
   */
  async setCryptoAddress(
    id: string,
    cryptoAddress: string,
    cryptoAmount: string,
    exchangeRate: string,
    expiresAt: Date,
    client?: PoolClient
  ): Promise<Payment> {
    const query = `
      UPDATE payments
      SET crypto_address = $1,
          crypto_amount = $2,
          exchange_rate = $3,
          expires_at = $4,
          updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;

    try {
      const executor = client || database;
      const result = await executor.query<Payment>(query, [
        cryptoAddress,
        cryptoAmount,
        exchangeRate,
        expiresAt,
        id,
      ]);
      if (result.rows.length === 0) {
        throw new NotFoundError('Payment', id);
      }
      logger.info('Crypto address set for payment', { paymentId: id, cryptoAddress });
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to set crypto address for payment', { id, error });
      throw new DatabaseError('Failed to set crypto address', { error });
    }
  }

  /**
   * Mark payment as detected (0-conf transaction in mempool)
   */
  async markAsDetected(id: string, client?: PoolClient): Promise<Payment> {
    const query = `
      UPDATE payments
      SET status = 'detected',
          detected_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    try {
      const executor = client || database;
      const result = await executor.query<Payment>(query, [id]);
      if (result.rows.length === 0) {
        throw new NotFoundError('Payment', id);
      }
      logger.info('Payment marked as detected', { paymentId: id });
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to mark payment as detected', { id, error });
      throw new DatabaseError('Failed to mark payment as detected', { error });
    }
  }

  /**
   * Mark payment as confirmed (reached confirmation threshold)
   */
  async markAsConfirmed(id: string, client?: PoolClient): Promise<Payment> {
    const query = `
      UPDATE payments
      SET status = 'confirmed',
          confirmed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    try {
      const executor = client || database;
      const result = await executor.query<Payment>(query, [id]);
      if (result.rows.length === 0) {
        throw new NotFoundError('Payment', id);
      }
      logger.info('Payment marked as confirmed', { paymentId: id });
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to mark payment as confirmed', { id, error });
      throw new DatabaseError('Failed to mark payment as confirmed', { error });
    }
  }
}

// Export singleton instance
export const paymentRepository = new PaymentRepository();
