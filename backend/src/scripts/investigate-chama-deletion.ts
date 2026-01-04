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
    console.log('🔍 Investigating Chama Deletion...\n');
    console.log('═'.repeat(60));

    // 1. Check if chamas table has deleted_at or soft delete
    console.log('\n📋 Chamas Table Structure:');
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'chamas'
      ORDER BY ordinal_position
    `);
    console.log('  Columns:');
    tableStructure.rows.forEach((col: any) => {
      console.log(`    - ${col.column_name} (${col.data_type})`);
    });

    // 2. Check for soft-deleted chamas (if deleted_at exists)
    const hasDeletedAt = tableStructure.rows.some((col: any) => col.column_name === 'deleted_at');
    if (hasDeletedAt) {
      const softDeleted = await pool.query(`
        SELECT COUNT(*) as count FROM chamas WHERE deleted_at IS NOT NULL
      `);
      console.log(`\n  Soft-deleted chamas: ${softDeleted.rows[0].count}`);
    }

    // 3. Check for closed chamas
    const closedChamas = await pool.query(`
      SELECT COUNT(*) as count FROM chamas WHERE status = 'closed'
    `);
    console.log(`\n  Closed chamas: ${closedChamas.rows[0].count}`);

    // 4. Check audit log for DELETE operations on chamas
    console.log('\n📝 Audit Log Check:');
    try {
      const auditDeletes = await pool.query(`
        SELECT 
          id,
          operation,
          record_id,
          user_id,
          created_at,
          old_data->>'name' as chama_name
        FROM audit_log
        WHERE table_name = 'chamas' AND operation = 'DELETE'
        ORDER BY created_at DESC
        LIMIT 20
      `);
      
      if (auditDeletes.rows.length > 0) {
        console.log(`  Found ${auditDeletes.rows.length} DELETE operations:`);
        auditDeletes.rows.forEach((entry: any) => {
          console.log(`    ${entry.created_at.toISOString()} - Deleted: ${entry.chama_name || entry.record_id}`);
          if (entry.user_id) {
            console.log(`      By user: ${entry.user_id}`);
          }
        });
      } else {
        console.log('  ⚠️  No DELETE operations found in audit_log for chamas');
        console.log('  Note: Audit log only tracks transactions, entries, accounts - not chamas');
      }
    } catch (error: any) {
      console.log(`  ⚠️  Could not check audit_log: ${error.message}`);
    }

    // 5. Check activity logs for chama deletions
    console.log('\n📊 Activity Logs Check:');
    try {
      const activityDeletes = await pool.query(`
        SELECT 
          id,
          chama_id,
          user_id,
          activity_type,
          title,
          description,
          created_at
        FROM activity_logs
        WHERE activity_type IN ('chama_deleted', 'chama_closed', 'chama_removed')
        ORDER BY created_at DESC
        LIMIT 20
      `);
      
      if (activityDeletes.rows.length > 0) {
        console.log(`  Found ${activityDeletes.rows.length} deletion activities:`);
        activityDeletes.rows.forEach((entry: any) => {
          console.log(`    ${entry.created_at.toISOString()} - ${entry.title}`);
          console.log(`      Chama: ${entry.chama_id}`);
          if (entry.user_id) {
            console.log(`      By user: ${entry.user_id}`);
          }
        });
      } else {
        console.log('  No deletion activities found');
      }
    } catch (error: any) {
      console.log(`  ⚠️  Could not check activity_logs: ${error.message}`);
    }

    // 6. Check for foreign key cascades that might have deleted chamas
    console.log('\n🔗 Foreign Key Constraints:');
    const foreignKeys = await pool.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'chamas'
        AND rc.delete_rule = 'CASCADE'
    `);
    
    if (foreignKeys.rows.length > 0) {
      console.log('  Tables with CASCADE delete on chamas:');
      foreignKeys.rows.forEach((fk: any) => {
        console.log(`    - ${fk.table_name}.${fk.column_name} -> chamas (${fk.delete_rule})`);
      });
    } else {
      console.log('  No CASCADE deletes found on chamas');
    }

    // 7. Check if admin_user_id deletion would cascade
    console.log('\n👤 User Deletion Check:');
    const userFk = await pool.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'chamas'
        AND kcu.column_name = 'admin_user_id'
        AND tc.constraint_type = 'FOREIGN KEY'
    `);
    
    if (userFk.rows.length > 0) {
      console.log(`  admin_user_id constraint: ${userFk.rows[0].delete_rule}`);
      if (userFk.rows[0].delete_rule === 'CASCADE') {
        console.log('  ⚠️  WARNING: Deleting a user would CASCADE delete their chamas!');
      } else if (userFk.rows[0].delete_rule === 'RESTRICT') {
        console.log('  ✅ Safe: User deletion is RESTRICTED (cannot delete user with chamas)');
      }
    }

    // 8. Check for any triggers on chamas table
    console.log('\n⚡ Triggers on chamas table:');
    const triggers = await pool.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'chamas'
    `);
    
    if (triggers.rows.length > 0) {
      console.log(`  Found ${triggers.rows.length} triggers:`);
      triggers.rows.forEach((trigger: any) => {
        console.log(`    - ${trigger.trigger_name} (${trigger.event_manipulation})`);
      });
    } else {
      console.log('  No triggers found');
    }

    // 9. Check PostgreSQL logs (if accessible)
    console.log('\n📋 Recent Database Operations:');
    console.log('  Note: Check PostgreSQL logs for DELETE statements');
    console.log('  Location: Check postgresql.log or use pg_stat_statements if enabled');

    // 10. Check if delete-duplicate-chamas script was run
    console.log('\n🔧 Script Execution Check:');
    console.log('  Check if cleanup:duplicates script was run:');
    console.log('  npm run cleanup:duplicates');
    console.log('  This script deletes chamas with duplicate names!');

    console.log('\n✅ Investigation complete\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

investigate();


