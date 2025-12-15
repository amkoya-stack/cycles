import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'cycle',
});

async function deleteDuplicateChamas() {
  const client = await pool.connect();

  try {
    console.log('🔍 Finding duplicate chamas...');

    // Find all chamas with the same name
    const duplicates = await client.query(`
      SELECT name, array_agg(id ORDER BY created_at) as ids, COUNT(*) as count
      FROM chamas
      GROUP BY name
      HAVING COUNT(*) > 1
    `);

    if (duplicates.rows.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }

    console.log(`\n📋 Found ${duplicates.rows.length} duplicate groups:\n`);

    for (const group of duplicates.rows) {
      console.log(`\nCycle: "${group.name}"`);
      console.log(`  Total: ${group.count} duplicates`);
      console.log(`  IDs: ${group.ids.join(', ')}`);

      // Keep the first one (oldest), delete the rest
      const [keepId, ...deleteIds] = group.ids;
      console.log(`  ✓ Keeping: ${keepId}`);
      console.log(`  ✗ Deleting: ${deleteIds.join(', ')}`);

      // Delete chama_members first (foreign key constraint)
      for (const id of deleteIds) {
        await client.query('DELETE FROM chama_members WHERE chama_id = $1', [
          id,
        ]);
      }

      // Delete the duplicate chamas
      await client.query('DELETE FROM chamas WHERE id = ANY($1)', [deleteIds]);

      console.log(`  ✅ Deleted ${deleteIds.length} duplicates`);
    }

    console.log('\n✅ Cleanup complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the cleanup
deleteDuplicateChamas()
  .then(() => {
    console.log('\n👍 Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
