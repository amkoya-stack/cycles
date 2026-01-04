/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Pool } from 'pg';
import { config } from 'dotenv';

config();

async function investigate() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'cycle',
  });

  try {
    console.log('🔍 Investigating database state...\n');

    // 1. Check migration history
    console.log('📋 Migration History:');
    console.log('─'.repeat(60));
    try {
      const migrations = await pool.query(
        'SELECT name, filename, executed_at FROM migrations ORDER BY executed_at DESC LIMIT 10',
      );
      if (migrations.rows.length > 0) {
        migrations.rows.forEach((m: any) => {
          console.log(
            `  ${m.executed_at.toISOString()} - ${m.filename}`,
          );
        });
        console.log(
          `\n  Last migration: ${migrations.rows[0].executed_at.toISOString()}`,
        );
      } else {
        console.log('  ⚠️  No migrations found in history table');
      }
    } catch (error: any) {
      console.log(`  ⚠️  Could not query migrations: ${error.message}`);
    }

    // 2. Check chamas table
    console.log('\n📊 Chamas Table:');
    console.log('─'.repeat(60));
    const chamasCount = await pool.query('SELECT COUNT(*) as count FROM chamas');
    console.log(`  Total chamas: ${chamasCount.rows[0].count}`);

    if (parseInt(chamasCount.rows[0].count) > 0) {
      const recentChamas = await pool.query(
        'SELECT id, name, created_at FROM chamas ORDER BY created_at DESC LIMIT 5',
      );
      console.log('  Recent chamas:');
      recentChamas.rows.forEach((c: any) => {
        console.log(
          `    - ${c.name} (created: ${c.created_at.toISOString()})`,
        );
      });
    } else {
      // Check if table exists and has any metadata
      const tableInfo = await pool.query(`
        SELECT 
          pg_size_pretty(pg_total_relation_size('chamas')) as size,
          (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'chamas') as column_count
      `);
      console.log(`  Table size: ${tableInfo.rows[0].size}`);
      console.log(`  Columns: ${tableInfo.rows[0].column_count}`);
    }

    // 3. Check chama_members
    console.log('\n👥 Chama Members:');
    console.log('─'.repeat(60));
    const membersCount = await pool.query(
      'SELECT COUNT(*) as count FROM chama_members',
    );
    console.log(`  Total memberships: ${membersCount.rows[0].count}`);

    // 4. Check database creation time
    console.log('\n🗄️  Database Info:');
    console.log('─'.repeat(60));
    const dbInfo = await pool.query(`
      SELECT 
        datname,
        pg_size_pretty(pg_database_size(datname)) as size,
        (SELECT MIN(created_at) FROM chamas) as oldest_chama,
        (SELECT MAX(created_at) FROM chamas) as newest_chama
      FROM pg_database 
      WHERE datname = current_database()
    `);
    if (dbInfo.rows.length > 0) {
      console.log(`  Database: ${dbInfo.rows[0].datname}`);
      console.log(`  Size: ${dbInfo.rows[0].size}`);
      if (dbInfo.rows[0].oldest_chama) {
        console.log(
          `  Oldest chama: ${dbInfo.rows[0].oldest_chama.toISOString()}`,
        );
        console.log(
          `  Newest chama: ${dbInfo.rows[0].newest_chama.toISOString()}`,
        );
      } else {
        console.log('  ⚠️  No chamas found');
      }
    }

    // 5. Check for any DROP or TRUNCATE in recent migrations
    console.log('\n🔎 Checking Recent Migrations for Data Deletion:');
    console.log('─'.repeat(60));
    try {
      const recentMigrations = await pool.query(
        'SELECT filename, executed_at FROM migrations ORDER BY executed_at DESC LIMIT 5',
      );
      if (recentMigrations.rows.length > 0) {
        console.log('  Recent migration files:');
        for (const mig of recentMigrations.rows) {
          console.log(`    - ${mig.filename} (${mig.executed_at.toISOString()})`);
        }
      }
    } catch (error: any) {
      console.log(`  ⚠️  Error: ${error.message}`);
    }

    // 6. Check users table (to see if data exists)
    console.log('\n👤 Users Table:');
    console.log('─'.repeat(60));
    const usersCount = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`  Total users: ${usersCount.rows[0].count}`);
    if (parseInt(usersCount.rows[0].count) > 0) {
      const recentUsers = await pool.query(
        'SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 3',
      );
      console.log('  Recent users:');
      recentUsers.rows.forEach((u: any) => {
        console.log(
          `    - ${u.email} (created: ${u.created_at?.toISOString() || 'N/A'})`,
        );
      });
    }

    // 7. Check if there's a rollback table
    console.log('\n🔄 Rollback History:');
    console.log('─'.repeat(60));
    try {
      const rollbacks = await pool.query(
        'SELECT type, target_id, reason, started_at, status FROM rollbacks ORDER BY started_at DESC LIMIT 5',
      );
      if (rollbacks.rows.length > 0) {
        rollbacks.rows.forEach((r: any) => {
          console.log(
            `  ${r.started_at.toISOString()} - ${r.type}: ${r.target_id} (${r.status})`,
          );
          console.log(`    Reason: ${r.reason}`);
        });
      } else {
        console.log('  No rollbacks recorded');
      }
    } catch (error: any) {
      console.log(`  ⚠️  Rollback table doesn't exist: ${error.message}`);
    }

    console.log('\n✅ Investigation complete\n');
  } catch (error) {
    console.error('❌ Investigation failed:', error);
  } finally {
    await pool.end();
  }
}

investigate();


