import { database, PoolClient } from '../connection';
import {
  BlockchainTransaction,
  CreateBlockchainTransactionInput,
  UpdateBlockchainTransactionInput,
} from '../../models/BlockchainTransaction';
import { CryptoCurrency } from '../../types';
import { NotFoundError, DatabaseError } from '../../utils/errors';
import { logger } from '../../utils/logger';

/**
 * BlockchainTransaction Repository
 * Data access layer for blockchain transaction operations
 */
export class BlockchainTransactionRepository {
  /**
   * Create a new blockchain transaction
   */
  async create(input: CreateBlockchainTransactionInput, client?: PoolClient): Promise<BlockchainTransaction> {
    const query = `
      INSERT INTO blockchain_transactions (
        payment_id, crypto_currency, txid, from_address, to_address, amount,
        confirmations, block_height, block_hash, is_shielded, memo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      input.payment_id,
      input.crypto_currency,
      input.txid,
      input.from_address || null,
      input.to_address,
      input.amount,
      input.confirmations || 0,
      input.block_height || null,
      input.block_hash || null,
      input.is_shielded || false,
      input.memo || null,
    ];

    try {
      const executor = client || database;
      const result = await executor.query<BlockchainTransaction>(query, values);
      logger.info('Blockchain transaction created', {
        txid: input.txid,
        paymentId: input.payment_id,
        cryptoCurrency: input.crypto_currency,
      });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create blockchain transaction', { error });
      throw new DatabaseError('Failed to create blockchain transaction', { error });
    }
  }

  /**
   * Find blockchain transaction by txid
   */
  async findByTxid(txid: string): Promise<BlockchainTransaction | null> {
    const query = 'SELECT * FROM blockchain_transactions WHERE txid = $1';

    try {
      const result = await database.query<BlockchainTransaction>(query, [txid]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find blockchain transaction by txid', { txid, error });
      throw new DatabaseError('Failed to find blockchain transaction', { error });
    }
  }

  /**
   * Find blockchain transaction by ID
   */
  async findById(id: string): Promise<BlockchainTransaction | null> {
    const query = 'SELECT * FROM blockchain_transactions WHERE id = $1';

    try {
      const result = await database.query<BlockchainTransaction>(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find blockchain transaction by ID', { id, error });
      throw new DatabaseError('Failed to find blockchain transaction', { error });
    }
  }

  /**
   * Find blockchain transactions by destination address
   * CRITICAL: Used by monitors to find all transactions to a specific address
   */
  async findByToAddress(address: string): Promise<BlockchainTransaction[]> {
    const query = `
      SELECT * FROM blockchain_transactions
      WHERE to_address = $1
      ORDER BY detected_at DESC
    `;

    try {
      const result = await database.query<BlockchainTransaction>(query, [address]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to find blockchain transactions by address', { address, error });
      throw new DatabaseError('Failed to find blockchain transactions', { error });
    }
  }

  /**
   * Find blockchain transactions by payment ID
   */
  async findByPaymentId(paymentId: string): Promise<BlockchainTransaction[]> {
    const query = `
      SELECT * FROM blockchain_transactions
      WHERE payment_id = $1
      ORDER BY detected_at DESC
    `;

    try {
      const result = await database.query<BlockchainTransaction>(query, [paymentId]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to find blockchain transactions by payment ID', { paymentId, error });
      throw new DatabaseError('Failed to find blockchain transactions', { error });
    }
  }

  /**
   * Update transaction confirmations
   */
  async updateConfirmations(
    txid: string,
    confirmations: number,
    blockHash?: string,
    blockHeight?: number,
    client?: PoolClient
  ): Promise<BlockchainTransaction> {
    const fields: string[] = ['confirmations = $1', 'updated_at = NOW()'];
    const values: any[] = [confirmations, txid];
    let paramIndex = 3;

    if (blockHash !== undefined) {
      fields.push(`block_hash = $${paramIndex++}`);
      values.splice(1, 0, blockHash);
    }

    if (blockHeight !== undefined) {
      fields.push(`block_height = $${paramIndex++}`);
      values.splice(blockHash !== undefined ? 2 : 1, 0, blockHeight);
    }

    const query = `
      UPDATE blockchain_transactions
      SET ${fields.join(', ')}
      WHERE txid = $${paramIndex}
      RETURNING *
    `;

    // Rebuild values array in correct order
    const finalValues: any[] = [confirmations];
    if (blockHash !== undefined) finalValues.push(blockHash);
    if (blockHeight !== undefined) finalValues.push(blockHeight);
    finalValues.push(txid);

    try {
      const executor = client || database;
      const result = await executor.query<BlockchainTransaction>(query, finalValues);
      if (result.rows.length === 0) {
        throw new NotFoundError('BlockchainTransaction', txid);
      }
      logger.debug('Transaction confirmations updated', { txid, confirmations });
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to update transaction confirmations', { txid, confirmations, error });
      throw new DatabaseError('Failed to update transaction confirmations', { error });
    }
  }

  /**
   * Find unconfirmed transactions for a specific cryptocurrency
   * Used by monitors to update confirmations on new blocks
   */
  async findUnconfirmedTransactions(
    currency: CryptoCurrency,
    confirmationThreshold: number = 6
  ): Promise<BlockchainTransaction[]> {
    const query = `
      SELECT * FROM blockchain_transactions
      WHERE crypto_currency = $1
        AND confirmations < $2
      ORDER BY detected_at ASC
    `;

    try {
      const result = await database.query<BlockchainTransaction>(query, [currency, confirmationThreshold]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to find unconfirmed transactions', { currency, error });
      throw new DatabaseError('Failed to find unconfirmed transactions', { error });
    }
  }

  /**
   * Update blockchain transaction
   */
  async update(id: string, input: UpdateBlockchainTransactionInput, client?: PoolClient): Promise<BlockchainTransaction> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.confirmations !== undefined) {
      fields.push(`confirmations = $${paramIndex++}`);
      values.push(input.confirmations);
    }
    if (input.block_height !== undefined) {
      fields.push(`block_height = $${paramIndex++}`);
      values.push(input.block_height);
    }
    if (input.block_hash !== undefined) {
      fields.push(`block_hash = $${paramIndex++}`);
      values.push(input.block_hash);
    }
    if (input.confirmed_at !== undefined) {
      fields.push(`confirmed_at = $${paramIndex++}`);
      values.push(input.confirmed_at);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE blockchain_transactions
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const executor = client || database;
      const result = await executor.query<BlockchainTransaction>(query, values);
      if (result.rows.length === 0) {
        throw new NotFoundError('BlockchainTransaction', id);
      }
      logger.info('Blockchain transaction updated', { id });
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to update blockchain transaction', { id, error });
      throw new DatabaseError('Failed to update blockchain transaction', { error });
    }
  }

  /**
   * Mark transaction as confirmed
   */
  async markAsConfirmed(id: string, client?: PoolClient): Promise<BlockchainTransaction> {
    const query = `
      UPDATE blockchain_transactions
      SET confirmed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    try {
      const executor = client || database;
      const result = await executor.query<BlockchainTransaction>(query, [id]);
      if (result.rows.length === 0) {
        throw new NotFoundError('BlockchainTransaction', id);
      }
      logger.info('Blockchain transaction marked as confirmed', { id });
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to mark transaction as confirmed', { id, error });
      throw new DatabaseError('Failed to mark transaction as confirmed', { error });
    }
  }

  /**
   * List blockchain transactions with pagination
   */
  async list(
    limit: number = 10,
    offset: number = 0,
    currency?: CryptoCurrency
  ): Promise<{ transactions: BlockchainTransaction[]; total: number }> {
    const whereClause = currency ? 'WHERE crypto_currency = $3' : '';
    const countQuery = `SELECT COUNT(*) FROM blockchain_transactions ${whereClause}`;
    const dataQuery = `
      SELECT * FROM blockchain_transactions
      ${whereClause}
      ORDER BY detected_at DESC
      LIMIT $1 OFFSET $2
    `;

    try {
      const countValues = currency ? [currency] : [];
      const dataValues = currency ? [limit, offset, currency] : [limit, offset];

      const [countResult, dataResult] = await Promise.all([
        database.query(countQuery, countValues),
        database.query<BlockchainTransaction>(dataQuery, dataValues),
      ]);

      return {
        transactions: dataResult.rows,
        total: parseInt(countResult.rows[0].count),
      };
    } catch (error) {
      logger.error('Failed to list blockchain transactions', { error });
      throw new DatabaseError('Failed to list blockchain transactions', { error });
    }
  }
}

// Export singleton instance
export const blockchainTransactionRepository = new BlockchainTransactionRepository();
