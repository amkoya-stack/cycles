/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Script to clean up duplicate in_progress meetings
 * Run this to delete duplicate meetings created due to missing idempotency
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_DATABASE || 'cycle',
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function cleanupDuplicateMeetings() {
  const client = await pool.connect();

  try {
    console.log('Starting cleanup of duplicate meetings...');

    // Find duplicate in_progress meetings (same title, same chama, same host)
    const duplicatesQuery = `
      WITH ranked_meetings AS (
        SELECT 
          id,
          chama_id,
          host_user_id,
          title,
          status,
          created_at,
          ROW_NUMBER() OVER (
            PARTITION BY chama_id, host_user_id, title 
            ORDER BY created_at ASC
          ) as rn
        FROM meetings
        WHERE status = 'in_progress'
      )
      SELECT id, title, created_at
      FROM ranked_meetings
      WHERE rn > 1
      ORDER BY created_at DESC;
    `;

    const duplicates = await client.query(duplicatesQuery);

    if (duplicates.rowCount === 0) {
      console.log('No duplicate meetings found.');
      return;
    }

    console.log(`Found ${duplicates.rowCount} duplicate meetings:`);
    duplicates.rows.forEach((meeting) => {
      console.log(
        `  - ${meeting.title} (${meeting.id}) - Created: ${meeting.created_at}`,
      );
    });

    // Delete duplicates (keeping the oldest one)
    const deleteQuery = `
      WITH ranked_meetings AS (
        SELECT 
          id,
          ROW_NUMBER() OVER (
            PARTITION BY chama_id, host_user_id, title 
            ORDER BY created_at ASC
          ) as rn
        FROM meetings
        WHERE status = 'in_progress'
      )
      DELETE FROM meetings
      WHERE id IN (
        SELECT id FROM ranked_meetings WHERE rn > 1
      )
      RETURNING id, title;
    `;

    const deleted = await client.query(deleteQuery);
    console.log(`\nDeleted ${deleted.rowCount} duplicate meetings.`);

    // Also update any old in_progress meetings to completed
    const updateOldQuery = `
      UPDATE meetings
      SET 
        status = 'completed',
        actual_end = NOW()
      WHERE status = 'in_progress'
        AND scheduled_start < NOW() - INTERVAL '2 hours'
      RETURNING id, title, scheduled_start;
    `;

    const updated = await client.query(updateOldQuery);
    if (updated.rowCount > 0) {
      console.log(`\nMarked ${updated.rowCount} old meetings as completed:`);
      updated.rows.forEach((meeting) => {
        console.log(`  - ${meeting.title} (${meeting.id})`);
      });
    }

    console.log('\nCleanup complete!');
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupDuplicateMeetings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  });
