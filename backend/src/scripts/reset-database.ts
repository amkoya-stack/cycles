/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Pool } from 'pg';
import { config } from 'dotenv';
import * as readline from 'readline';

config();

async function resetDatabase() {
  const dbName = process.env.DB_DATABASE || 'cycle';
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5432');
  const user = process.env.DB_USERNAME || 'postgres';
  const password = process.env.DB_PASSWORD || '';

  // SAFETY CHECK: Block production environment
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '❌ CRITICAL ERROR: Cannot run database reset in production!',
    );
    console.error('❌ This operation is disabled in production for safety.');
    process.exit(1);
  }

  // SAFETY CHECK: Require explicit confirmation
  console.log(
    '\n╔═══════════════════════════════════════════════════════════╗',
  );
  console.log('║                    ⚠️  DANGER ZONE ⚠️                     ║');
  console.log('║                                                           ║');
  console.log('║  YOU ARE ABOUT TO DELETE THE ENTIRE DATABASE!            ║');
  console.log('║                                                           ║');
  console.log('║  This will permanently delete:                            ║');
  console.log('║  • All chamas/cycles                                      ║');
  console.log('║  • All user accounts and wallets                          ║');
  console.log('║  • All contributions and transactions                     ║');
  console.log('║  • All ledger entries                                     ║');
  console.log('║  • ALL DATA IN THE DATABASE                               ║');
  console.log('║                                                           ║');
  console.log(`║  Database: ${dbName.padEnd(46)} ║`);
  console.log(`║  Host: ${(host + ':' + port).padEnd(50)} ║`);
  console.log(
    '╚═══════════════════════════════════════════════════════════╝\n',
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question(
      'Type "DELETE EVERYTHING" (case-sensitive) to confirm: ',
      resolve,
    );
  });

  rl.close();

  if (answer !== 'DELETE EVERYTHING') {
    console.log('❌ Reset cancelled. Database was NOT modified.');
    process.exit(0);
  }

  // Second confirmation
  const rl2 = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const secondAnswer = await new Promise<string>((resolve) => {
    rl2.question(
      '\n⚠️  Last chance! Type "YES" to proceed with deletion: ',
      resolve,
    );
  });

  rl2.close();

  if (secondAnswer !== 'YES') {
    console.log('❌ Reset cancelled. Database was NOT modified.');
    process.exit(0);
  }

  console.log('\n🔥 Proceeding with database reset...\n');

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
