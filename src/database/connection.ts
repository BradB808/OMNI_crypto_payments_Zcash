import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '../utils/logger';

/**
 * PostgreSQL connection pool manager
 * Provides connection pooling, transaction support, and query execution
 */
class Database {
  private pool: Pool | null = null;
  private isConnected: boolean = false;

  /**
   * Initialize the database connection pool
   */
  public async connect(): Promise<void> {
    if (this.isConnected && this.pool) {
      logger.warn('Database already connected');
      return;
    }

    try {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
        min: parseInt(process.env.DATABASE_POOL_MIN || '2'),
        max: parseInt(process.env.DATABASE_POOL_MAX || '10'),
        idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT_MS || '30000'),
        connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT_MS || '2000'),
      });

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      logger.info('Database connection established successfully');

      // Handle pool errors
      this.pool.on('error', (err) => {
        logger.error('Unexpected database pool error:', err);
      });
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw new Error('Database connection failed');
    }
  }

  /**
   * Close the database connection pool
   */
  public async disconnect(): Promise<void> {
    if (!this.pool) {
      logger.warn('Database already disconnected');
      return;
    }

    try {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      logger.info('Database connection closed successfully');
    } catch (error) {
      logger.error('Error closing database connection:', error);
      throw error;
    }
  }

  /**
   * Execute a SQL query
   */
  public async query<T = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    this.ensureConnected();

    const start = Date.now();
    try {
      const result = await this.pool!.query<T>(text, params);
      const duration = Date.now() - start;

      logger.debug('Query executed', {
        text: text.substring(0, 100),
        duration,
        rows: result.rowCount,
      });

      return result;
    } catch (error) {
      logger.error('Query execution failed:', {
        text: text.substring(0, 100),
        error,
      });
      throw error;
    }
  }

  /**
   * Get a client from the pool for transaction support
   */
  public async getClient(): Promise<PoolClient> {
    this.ensureConnected();
    return await this.pool!.connect();
  }

  /**
   * Execute multiple queries in a transaction
   */
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if database is connected
   */
  public get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Get the underlying pool instance (use with caution)
   */
  public getPool(): Pool {
    this.ensureConnected();
    return this.pool!;
  }

  /**
   * Ensure database is connected before operations
   */
  private ensureConnected(): void {
    if (!this.isConnected || !this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }
  }

  /**
   * Health check - verify database connection
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health');
      return result.rows[0].health === 1;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Get pool statistics
   */
  public getStats() {
    if (!this.pool) {
      return null;
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}

// Export singleton instance
export const database = new Database();

// Export types
export type { PoolClient, QueryResult };
