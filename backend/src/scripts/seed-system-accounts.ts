/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Pool } from 'pg';
import { config } from 'dotenv';

config();

async function ensureSystemAccount(
  client: any,
  ledgerId: string,
  code: string,
  name: string,
) {
  const atRes = await client.query(
    'SELECT id FROM account_types WHERE code = $1',
    [code],
  );
  if (atRes.rows.length === 0) {
    throw new Error(`Account type ${code} not found. Run migrations.`);
  }

  const accountTypeId = atRes.rows[0].id;

  const existing = await client.query(
    'SELECT id FROM accounts WHERE account_type_id = $1 LIMIT 1',
    [accountTypeId],
  );
  if (existing.rows.length > 0) {
    console.log(
      `✅ System account for ${code} already exists: ${existing.rows[0].id}`,
    );
    return existing.rows[0].id as string;
  }

  const accountNumber = `SYS-${code}-${Date.now()}-${Math.floor(
    Math.random() * 1000,
  )}`;

  const insert = await client.query(
    `INSERT INTO accounts (
      ledger_id, account_type_id, account_number, name, status
    ) VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
    [ledgerId, accountTypeId, accountNumber, name],
  );

  const id = insert.rows[0].id as string;
  console.log(`✨ Created system account ${code}: ${id}`);
  return id;
}

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'chama_platform',
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ledgerRes = await client.query(
      'SELECT id, name FROM ledgers WHERE is_active = true LIMIT 1',
    );
    if (ledgerRes.rows.length === 0) {
      throw new Error('No active ledger found. Run migrations first.');
    }
    const ledgerId = ledgerRes.rows[0].id as string;
    console.log(`Using ledger: ${ledgerRes.rows[0].name} (${ledgerId})`);

    // Ensure essential system accounts exist
    await ensureSystemAccount(client, ledgerId, 'CASH', 'Platform Cash');
    await ensureSystemAccount(
      client,
      ledgerId,
      'REVENUE_FEES',
      'Platform Fee Revenue',
    );
    await ensureSystemAccount(client, ledgerId, 'EQUITY', 'Platform Equity');

    await client.query('COMMIT');
    console.log('✅ System accounts seeded.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to seed system accounts:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
