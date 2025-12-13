/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Pool } from 'pg';
import { config } from 'dotenv';

config();

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'cycle',
  });

  try {
    const existing = await pool.query(
      'SELECT id FROM ledgers WHERE is_active = true LIMIT 1',
    );
    if (existing.rows.length > 0) {
      console.log('✅ Active ledger already exists:', existing.rows[0].id);
      return;
    }

    const res = await pool.query(
      `INSERT INTO ledgers (name, description, currency, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id`,
      ['Primary Ledger', 'Default active ledger for development', 'KES'],
    );
    console.log('✅ Seeded active ledger:', res.rows[0].id);
  } catch (err) {
    console.error('❌ Failed to seed ledger:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
