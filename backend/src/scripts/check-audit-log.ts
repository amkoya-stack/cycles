/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Pool } from 'pg';
import { config } from 'dotenv';

config();

async function checkAuditLog() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'cycle',
  });

  try {
    console.log('🔍 Checking audit log for chama deletions...\n');

    // Check if audit_log table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_log'
      )
    `);

    if (!tableExists.rows[0].exists) {
      console.log('⚠️  Audit log table does not exist');
      return;
    }

    // Check for any DELETE operations on chamas
    const deletes = await pool.query(`
      SELECT * FROM audit_log 
      WHERE table_name = 'chamas' 
      OR (table_name = 'chama_members' AND operation = 'DELETE')
      ORDER BY created_at DESC 
      LIMIT 20
    `);

    if (deletes.rows.length > 0) {
      console.log(`📋 Found ${deletes.rows.length} relevant audit log entries:\n`);
      deletes.rows.forEach((entry: any) => {
        console.log(`  ${entry.created_at.toISOString()} - ${entry.operation} on ${entry.table_name}`);
        if (entry.old_data) {
          console.log(`    Old data: ${JSON.stringify(entry.old_data).substring(0, 100)}...`);
        }
      });
    } else {
      console.log('✅ No DELETE operations found in audit log for chamas or chama_members');
    }

    // Check for any recent DELETE operations
    const recentDeletes = await pool.query(`
      SELECT * FROM audit_log 
      WHERE operation = 'DELETE'
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    if (recentDeletes.rows.length > 0) {
      console.log('\n📋 Recent DELETE operations (any table):\n');
      recentDeletes.rows.forEach((entry: any) => {
        console.log(`  ${entry.created_at.toISOString()} - ${entry.operation} on ${entry.table_name}`);
      });
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAuditLog();


