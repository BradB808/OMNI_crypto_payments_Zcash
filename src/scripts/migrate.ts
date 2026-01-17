import { readFileSync } from 'fs';
import { join } from 'path';
import { database } from '../database/connection';
import { logger } from '../utils/logger';

/**
 * Database migration script
 * Runs SQL migration files to set up the database schema
 */
async function runMigrations() {
  try {
    logger.info('Starting database migrations...');

    // Connect to database
    await database.connect();

    // Read migration file
    const migrationPath = join(__dirname, '../database/migrations/001_initial_schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Execute migration
    logger.info('Executing migration: 001_initial_schema.sql');
    await database.query(migrationSQL);

    logger.info('✅ Database migrations completed successfully');

    // Disconnect
    await database.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    await database.disconnect();
    process.exit(1);
  }
}

// Run migrations
runMigrations();
