/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Pool } from 'pg';
import { config } from 'dotenv';

config();

async function resetDatabase() {
  const dbName = process.env.DB_DATABASE || 'cycle';
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5432');
  const user = process.env.DB_USERNAME || 'postgres';
  const password = process.env.DB_PASSWORD || '';

  // Connect to maintenance DB 'postgres' to drop/recreate target DB
  const maintenancePool = new Pool({
    host,
    port,
    user,
    password,
    database: 'postgres',
  });

  console.log(
    `⚠️  Resetting database '${dbName}' on ${host}:${port} as ${user}`,
  );

  try {
    // Terminate active connections
    await maintenancePool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid();`,
      [dbName],
    );
    console.log('🔌 Terminated active connections');

    // Drop DB if exists
    await maintenancePool.query(
      `DROP DATABASE IF EXISTS ${JSON.stringify(dbName).replace(/"/g, '')};`,
    );
    console.log('🗑️  Dropped existing database (if any)');

    // Recreate DB
    await maintenancePool.query(
      `CREATE DATABASE ${JSON.stringify(dbName).replace(/"/g, '')};`,
    );
    console.log('📦 Created fresh database');
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  } finally {
    await maintenancePool.end();
  }

  console.log('✅ Reset complete');
}

resetDatabase();
