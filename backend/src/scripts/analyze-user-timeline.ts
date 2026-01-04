/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Pool } from 'pg';
import { config } from 'dotenv';

config();

async function analyzeTimeline() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'cycle',
  });

  try {
    console.log('🔍 Analyzing Timeline Discrepancy...\n');
    console.log('═'.repeat(60));

    // 1. Check current database time
    const now = await pool.query('SELECT NOW() as current_time, CURRENT_DATE as current_date');
    console.log('\n🕐 Current Database Time:');
    console.log(`  NOW(): ${now.rows[0].current_time.toISOString()}`);
    console.log(`  CURRENT_DATE: ${now.rows[0].current_date.toISOString()}`);
    console.log(`  Local: ${new Date().toISOString()}`);

    // 2. Check user creation dates
    console.log('\n👤 User Creation Timeline:');
    const users = await pool.query(`
      SELECT 
        id,
        email,
        full_name,
        created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 as days_ago
      FROM users
      ORDER BY created_at DESC
    `);
    
    users.rows.forEach((user: any) => {
      console.log(`  ${user.email}`);
      console.log(`    Created: ${user.created_at.toISOString()}`);
      console.log(`    Days ago: ${Math.round(user.days_ago * 10) / 10}`);
    });

    // 3. Check migration execution dates
    console.log('\n📋 Migration Execution Timeline:');
    const migrations = await pool.query(`
      SELECT 
        filename,
        executed_at,
        EXTRACT(EPOCH FROM (NOW() - executed_at)) / 86400 as days_ago
      FROM migrations
      ORDER BY executed_at DESC
      LIMIT 5
    `);
    
    migrations.rows.forEach((mig: any) => {
      console.log(`  ${mig.filename}`);
      console.log(`    Executed: ${mig.executed_at.toISOString()}`);
      console.log(`    Days ago: ${Math.round(mig.days_ago * 10) / 10}`);
    });

    // 4. Check if there are any other tables with data
    console.log('\n📊 Other Tables with Data:');
    const tablesWithData = await pool.query(`
      SELECT 
        'chama_members' as table_name, COUNT(*) as count FROM chama_members
      UNION ALL
      SELECT 'accounts', COUNT(*) FROM accounts
      UNION ALL
      SELECT 'transactions', COUNT(*) FROM transactions
      UNION ALL
      SELECT 'entries', COUNT(*) FROM entries
      UNION ALL
      SELECT 'contributions', COUNT(*) FROM contributions
      UNION ALL
      SELECT 'loans', COUNT(*) FROM loans
      UNION ALL
      SELECT 'proposals', COUNT(*) FROM proposals
      UNION ALL
      SELECT 'activity_logs', COUNT(*) FROM activity_logs
    `);
    
    tablesWithData.rows.forEach((row: any) => {
      if (parseInt(row.count) > 0) {
        console.log(`  ${row.table_name}: ${row.count} records`);
      }
    });

    // 5. Check database creation time (if possible)
    console.log('\n🗄️  Database Metadata:');
    const dbInfo = await pool.query(`
      SELECT 
        datname,
        pg_size_pretty(pg_database_size(datname)) as size,
        (SELECT MIN(created_at) FROM users) as oldest_user,
        (SELECT MAX(created_at) FROM users) as newest_user,
        (SELECT MIN(executed_at) FROM migrations) as first_migration,
        (SELECT MAX(executed_at) FROM migrations) as last_migration
      FROM pg_database 
      WHERE datname = current_database()
    `);
    
    if (dbInfo.rows.length > 0) {
      const info = dbInfo.rows[0];
      console.log(`  Database: ${info.datname}`);
      console.log(`  Size: ${info.size}`);
      if (info.oldest_user) {
        console.log(`  Oldest user: ${info.oldest_user.toISOString()}`);
        console.log(`  Newest user: ${info.newest_user.toISOString()}`);
      }
      if (info.first_migration) {
        console.log(`  First migration: ${info.first_migration.toISOString()}`);
        console.log(`  Last migration: ${info.last_migration.toISOString()}`);
      }
    }

    // 6. Check for timezone issues
    console.log('\n🌍 Timezone Information:');
    const tzInfo = await pool.query(`
      SELECT 
        current_setting('timezone') as timezone,
        current_setting('log_timezone') as log_timezone,
        NOW() as server_time,
        NOW() AT TIME ZONE 'UTC' as utc_time
    `);
    console.log(`  Timezone: ${tzInfo.rows[0].timezone}`);
    console.log(`  Log Timezone: ${tzInfo.rows[0].log_timezone}`);
    console.log(`  Server Time: ${tzInfo.rows[0].server_time.toISOString()}`);
    console.log(`  UTC Time: ${tzInfo.rows[0].utc_time}`);

    console.log('\n✅ Analysis complete\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

analyzeTimeline();


