/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Script to end all active meetings
 * Run this to mark all in_progress meetings as completed
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

async function endAllActiveMeetings() {
  const client = await pool.connect();

  try {
    console.log('Ending all active meetings...');

    const updateQuery = `
      UPDATE meetings
      SET 
        status = 'completed',
        actual_end = NOW()
      WHERE status = 'in_progress'
      RETURNING id, title, scheduled_start;
    `;

    const result = await client.query(updateQuery);

    if (result.rowCount === 0) {
      console.log('No active meetings found.');
    } else {
      console.log(`Ended ${result.rowCount} meeting(s):`);
      result.rows.forEach((meeting) => {
        console.log(`  - ${meeting.title} (${meeting.id})`);
      });
    }

    console.log('\nAll active meetings have been ended.');
  } catch (error) {
    console.error('Error ending meetings:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

endAllActiveMeetings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to end meetings:', error);
    process.exit(1);
  });
