import { database, PoolClient } from '../connection';
import { WebhookEvent, CreateWebhookEventInput, UpdateWebhookEventInput } from '../../models/WebhookEvent';
import { WebhookStatus, WebhookEventType } from '../../types';
import { NotFoundError, DatabaseError } from '../../utils/errors';
import { logger } from '../../utils/logger';

/**
 * WebhookEvent Repository
 * Data access layer for webhook event operations
 */
export class WebhookEventRepository {
  /**
   * Create a new webhook event
   */
  async create(input: CreateWebhookEventInput, client?: PoolClient): Promise<WebhookEvent> {
    const query = `
      INSERT INTO webhook_events (
        merchant_id, payment_id, event_type, payload, status, attempts
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      input.merchant_id,
      input.payment_id || null,
      input.event_type,
      JSON.stringify(input.payload),
      'pending' as WebhookStatus, // New events start as pending
      0, // Initial attempts count
    ];

    try {
      const executor = client || database;
      const result = await executor.query<WebhookEvent>(query, values);
      logger.info('Webhook event created', {
        eventId: result.rows[0].id,
        merchantId: input.merchant_id,
        eventType: input.event_type,
        paymentId: input.payment_id,
      });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create webhook event', { error });
      throw new DatabaseError('Failed to create webhook event', { error });
    }
  }

  /**
   * Find webhook event by ID
   */
  async findById(id: string): Promise<WebhookEvent | null> {
    const query = 'SELECT * FROM webhook_events WHERE id = $1';

    try {
      const result = await database.query<WebhookEvent>(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find webhook event by ID', { id, error });
      throw new DatabaseError('Failed to find webhook event', { error });
    }
  }

  /**
   * Find webhook events by payment ID
   */
  async findByPaymentId(paymentId: string): Promise<WebhookEvent[]> {
    const query = `
      SELECT * FROM webhook_events
      WHERE payment_id = $1
      ORDER BY created_at DESC
    `;

    try {
      const result = await database.query<WebhookEvent>(query, [paymentId]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to find webhook events by payment ID', { paymentId, error });
      throw new DatabaseError('Failed to find webhook events', { error });
    }
  }

  /**
   * Find pending webhook events that need delivery
   * CRITICAL: Used by webhook worker to process delivery queue
   */
  async findPendingEvents(limit: number = 10): Promise<WebhookEvent[]> {
    const query = `
      SELECT * FROM webhook_events
      WHERE status = 'pending'
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY created_at ASC
      LIMIT $1
    `;

    try {
      const result = await database.query<WebhookEvent>(query, [limit]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to find pending webhook events', { limit, error });
      throw new DatabaseError('Failed to find pending webhook events', { error });
    }
  }

  /**
   * Find webhook events by status
   */
  async findByStatus(status: WebhookStatus): Promise<WebhookEvent[]> {
    const query = `
      SELECT * FROM webhook_events
      WHERE status = $1
      ORDER BY created_at DESC
    `;

    try {
      const result = await database.query<WebhookEvent>(query, [status]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to find webhook events by status', { status, error });
      throw new DatabaseError('Failed to find webhook events by status', { error });
    }
  }

  /**
   * Mark webhook event as delivered
   */
  async markAsDelivered(
    id: string,
    responseStatusCode: number,
    responseBody: string,
    client?: PoolClient
  ): Promise<WebhookEvent> {
    const query = `
      UPDATE webhook_events
      SET status = 'delivered',
          delivered_at = NOW(),
          response_status_code = $2,
          response_body = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    try {
      const executor = client || database;
      const result = await executor.query<WebhookEvent>(query, [id, responseStatusCode, responseBody]);
      if (result.rows.length === 0) {
        throw new NotFoundError('WebhookEvent', id);
      }
      logger.info('Webhook event marked as delivered', { eventId: id, responseStatusCode });
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to mark webhook event as delivered', { id, error });
      throw new DatabaseError('Failed to mark webhook event as delivered', { error });
    }
  }

  /**
   * Mark webhook event as failed
   */
  async markAsFailed(
    id: string,
    errorMessage: string,
    responseStatusCode?: number,
    responseBody?: string,
    client?: PoolClient
  ): Promise<WebhookEvent> {
    const query = `
      UPDATE webhook_events
      SET status = 'failed',
          last_error = $2,
          response_status_code = $3,
          response_body = $4,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    try {
      const executor = client || database;
      const result = await executor.query<WebhookEvent>(query, [
        id,
        errorMessage,
        responseStatusCode || null,
        responseBody || null,
      ]);
      if (result.rows.length === 0) {
        throw new NotFoundError('WebhookEvent', id);
      }
      logger.warn('Webhook event marked as failed', { eventId: id, error: errorMessage });
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to mark webhook event as failed', { id, error });
      throw new DatabaseError('Failed to mark webhook event as failed', { error });
    }
  }

  /**
   * Increment webhook event attempts and set next retry time
   */
  async incrementAttempts(id: string, nextRetryAt: Date, client?: PoolClient): Promise<WebhookEvent> {
    const query = `
      UPDATE webhook_events
      SET attempts = attempts + 1,
          next_retry_at = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    try {
      const executor = client || database;
      const result = await executor.query<WebhookEvent>(query, [id, nextRetryAt]);
      if (result.rows.length === 0) {
        throw new NotFoundError('WebhookEvent', id);
      }
      logger.debug('Webhook event attempts incremented', {
        eventId: id,
        attempts: result.rows[0].attempts,
        nextRetryAt,
      });
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to increment webhook event attempts', { id, error });
      throw new DatabaseError('Failed to increment webhook event attempts', { error });
    }
  }

  /**
   * Update webhook event
   */
  async update(id: string, input: UpdateWebhookEventInput, client?: PoolClient): Promise<WebhookEvent> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic UPDATE query
    if (input.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.attempts !== undefined) {
      fields.push(`attempts = $${paramIndex++}`);
      values.push(input.attempts);
    }
    if (input.next_retry_at !== undefined) {
      fields.push(`next_retry_at = $${paramIndex++}`);
      values.push(input.next_retry_at);
    }
    if (input.last_error !== undefined) {
      fields.push(`last_error = $${paramIndex++}`);
      values.push(input.last_error);
    }
    if (input.response_status_code !== undefined) {
      fields.push(`response_status_code = $${paramIndex++}`);
      values.push(input.response_status_code);
    }
    if (input.response_body !== undefined) {
      fields.push(`response_body = $${paramIndex++}`);
      values.push(input.response_body);
    }
    if (input.delivered_at !== undefined) {
      fields.push(`delivered_at = $${paramIndex++}`);
      values.push(input.delivered_at);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE webhook_events
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const executor = client || database;
      const result = await executor.query<WebhookEvent>(query, values);
      if (result.rows.length === 0) {
        throw new NotFoundError('WebhookEvent', id);
      }
      logger.info('Webhook event updated', { eventId: id });
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to update webhook event', { id, error });
      throw new DatabaseError('Failed to update webhook event', { error });
    }
  }

  /**
   * List webhook events for a merchant with pagination
   */
  async listByMerchant(
    merchantId: string,
    limit: number = 10,
    offset: number = 0,
    status?: WebhookStatus
  ): Promise<{ events: WebhookEvent[]; total: number }> {
    const whereClause = status
      ? 'WHERE merchant_id = $3 AND status = $4'
      : 'WHERE merchant_id = $3';

    const countQuery = `SELECT COUNT(*) FROM webhook_events ${whereClause}`;
    const dataQuery = `
      SELECT * FROM webhook_events
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    try {
      const countValues = status ? [merchantId, status] : [merchantId];
      const dataValues = status ? [limit, offset, merchantId, status] : [limit, offset, merchantId];

      const [countResult, dataResult] = await Promise.all([
        database.query(countQuery, countValues),
        database.query<WebhookEvent>(dataQuery, dataValues),
      ]);

      return {
        events: dataResult.rows,
        total: parseInt(countResult.rows[0].count),
      };
    } catch (error) {
      logger.error('Failed to list webhook events by merchant', { merchantId, error });
      throw new DatabaseError('Failed to list webhook events', { error });
    }
  }

  /**
   * Find failed webhook events that exceed retry attempts threshold
   * Used for cleanup or alerting
   */
  async findFailedEventsExceedingRetries(maxAttempts: number = 5): Promise<WebhookEvent[]> {
    const query = `
      SELECT * FROM webhook_events
      WHERE status = 'pending'
        AND attempts >= $1
      ORDER BY created_at ASC
    `;

    try {
      const result = await database.query<WebhookEvent>(query, [maxAttempts]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to find failed webhook events exceeding retries', { maxAttempts, error });
      throw new DatabaseError('Failed to find failed webhook events', { error });
    }
  }

  /**
   * Delete old webhook events (for cleanup)
   * Only deletes delivered events older than specified days
   */
  async deleteOldDeliveredEvents(daysOld: number = 30): Promise<number> {
    const query = `
      DELETE FROM webhook_events
      WHERE status = 'delivered'
        AND delivered_at < NOW() - INTERVAL '${daysOld} days'
    `;

    try {
      const result = await database.query(query);
      logger.info('Old webhook events deleted', { count: result.rowCount, daysOld });
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to delete old webhook events', { daysOld, error });
      throw new DatabaseError('Failed to delete old webhook events', { error });
    }
  }
}

// Export singleton instance
export const webhookEventRepository = new WebhookEventRepository();
