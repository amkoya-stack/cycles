/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Pool } from 'pg';
import { config } from 'dotenv';

config();

async function checkLogs() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'cycle',
  });

  try {
    console.log('🔍 Checking PostgreSQL Query Statistics...\n');
    console.log('═'.repeat(60));

    // Check if pg_stat_statements is enabled
    console.log('\n📊 pg_stat_statements Extension:');
    try {
      const extension = await pool.query(`
        SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements'
      `);
      
      if (extension.rows.length > 0) {
        console.log('  ✅ pg_stat_statements is enabled');
        
        // Get recent DELETE queries
        const deleteQueries = await pool.query(`
          SELECT 
            query,
            calls,
            total_exec_time,
            mean_exec_time,
            max_exec_time,
            min_exec_time
          FROM pg_stat_statements
          WHERE query ILIKE '%DELETE%chamas%'
             OR query ILIKE '%DELETE%FROM%chamas%'
             OR query ILIKE '%TRUNCATE%chamas%'
          ORDER BY calls DESC
          LIMIT 10
        `);
        
        if (deleteQueries.rows.length > 0) {
          console.log('\n  Recent DELETE queries on chamas:');
          deleteQueries.rows.forEach((q: any) => {
            console.log(`    Calls: ${q.calls}`);
            console.log(`    Query: ${q.query.substring(0, 200)}...`);
            console.log(`    Total time: ${q.total_exec_time}ms`);
            console.log('');
          });
        } else {
          console.log('  No DELETE queries found in pg_stat_statements');
        }
      } else {
        console.log('  ⚠️  pg_stat_statements extension not enabled');
        console.log('  Enable it to track query history');
      }
    } catch (error: any) {
      console.log(`  ⚠️  Could not check pg_stat_statements: ${error.message}`);
    }

    // Check for any remaining traces in related tables
    console.log('\n🔗 Checking Related Tables for Chama Traces:');
    
    // Check chama_members for orphaned records
    const orphanedMembers = await pool.query(`
      SELECT COUNT(*) as count
      FROM chama_members cm
      WHERE NOT EXISTS (SELECT 1 FROM chamas c WHERE c.id = cm.chama_id)
    `);
    console.log(`  Orphaned chama_members: ${orphanedMembers.rows[0].count}`);
    
    // Check if there are any references to chamas in other tables
    const chamaReferences = await pool.query(`
      SELECT 
        'contributions' as table_name, COUNT(*) as count 
      FROM contributions 
      WHERE chama_id IS NOT NULL
      UNION ALL
      SELECT 'payouts', COUNT(*) FROM payouts WHERE chama_id IS NOT NULL
      UNION ALL
      SELECT 'loans', COUNT(*) FROM loans WHERE chama_id IS NOT NULL
      UNION ALL
      SELECT 'proposals', COUNT(*) FROM proposals WHERE chama_id IS NOT NULL
      UNION ALL
      SELECT 'meetings', COUNT(*) FROM meetings WHERE chama_id IS NOT NULL
    `);
    
    console.log('\n  References to chamas in other tables:');
    chamaReferences.rows.forEach((ref: any) => {
      if (parseInt(ref.count) > 0) {
        console.log(`    ${ref.table_name}: ${ref.count} records (orphaned)`);
      }
    });

    // Check for any chama names in activity logs
    console.log('\n📝 Checking Activity Logs for Chama Names:');
    try {
      const activityChamas = await pool.query(`
        SELECT DISTINCT
          metadata->>'chama_name' as chama_name,
          metadata->>'chama_id' as chama_id,
          MAX(created_at) as last_activity
        FROM activity_logs
        WHERE metadata->>'chama_name' IS NOT NULL
        GROUP BY metadata->>'chama_name', metadata->>'chama_id'
        ORDER BY last_activity DESC
        LIMIT 10
      `);
      
      if (activityChamas.rows.length > 0) {
        console.log('  Chamas mentioned in activity logs:');
        activityChamas.rows.forEach((act: any) => {
          console.log(`    - ${act.chama_name} (ID: ${act.chama_id?.substring(0, 8)}...)`);
          console.log(`      Last activity: ${act.last_activity?.toISOString() || 'N/A'}`);
        });
      } else {
        console.log('  No chama names found in activity logs');
      }
    } catch (error: any) {
      console.log(`  ⚠️  Could not check activity logs: ${error.message}`);
    }

    console.log('\n✅ Log check complete\n');
    console.log('💡 Next Steps:');
    console.log('  1. Check PostgreSQL server logs for DELETE statements');
    console.log('  2. Check if cleanup:duplicates script was run');
    console.log('  3. Check application logs for DELETE API calls');
    console.log('  4. Check if anyone has direct database access');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkLogs();


