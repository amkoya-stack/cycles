/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Pool } from 'pg';
import { config } from 'dotenv';

config();

async function checkReminders() {
  console.log('🔔 Checking Dispute Reminder Status...\n');

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'cycle',
  });

  try {
    // Check disputes with upcoming voting deadlines
    console.log('🗳️  Checking voting deadlines...');
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const votingDisputes = await pool.query(
      `SELECT d.id, d.title, d.voting_deadline, d.vote_count, d.required_votes,
              c.name as chama_name,
              COUNT(DISTINCT dv.user_id) as votes_cast
       FROM disputes d
       JOIN chamas c ON d.chama_id = c.id
       LEFT JOIN dispute_votes dv ON d.id = dv.dispute_id
       WHERE d.status = 'voting'
         AND d.voting_deadline IS NOT NULL
         AND d.voting_deadline BETWEEN $1 AND $2
         AND d.voting_deadline > CURRENT_TIMESTAMP
       GROUP BY d.id, d.title, d.voting_deadline, d.vote_count, d.required_votes, c.name
       ORDER BY d.voting_deadline ASC`,
      [now, oneDayFromNow],
    );

    console.log(`   Found ${votingDisputes.rows.length} dispute(s) with upcoming voting deadlines:`);
    votingDisputes.rows.forEach((dispute, index) => {
      const deadline = new Date(dispute.voting_deadline);
      const hoursUntil = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60));
      const votesNeeded = (dispute.required_votes || 0) - parseInt(dispute.votes_cast || '0');
      
      console.log(`   ${index + 1}. ${dispute.title}`);
      console.log(`      Chama: ${dispute.chama_name}`);
      console.log(`      Deadline: ${deadline.toLocaleString()} (${hoursUntil} hours)`);
      console.log(`      Votes: ${dispute.votes_cast}/${dispute.required_votes || 'N/A'} (${votesNeeded > 0 ? votesNeeded + ' needed' : 'complete'})`);
    });

    // Check disputes with upcoming discussion deadlines
    console.log('\n💬 Checking discussion deadlines...');
    const discussionDisputes = await pool.query(
      `SELECT d.id, d.title, d.discussion_deadline, d.comment_count,
              c.name as chama_name
       FROM disputes d
       JOIN chamas c ON d.chama_id = c.id
       WHERE d.status = 'discussion'
         AND d.discussion_deadline IS NOT NULL
         AND d.discussion_deadline BETWEEN $1 AND $2
         AND d.discussion_deadline > CURRENT_TIMESTAMP
       ORDER BY d.discussion_deadline ASC`,
      [now, oneDayFromNow],
    );

    console.log(`   Found ${discussionDisputes.rows.length} dispute(s) with upcoming discussion deadlines:`);
    discussionDisputes.rows.forEach((dispute, index) => {
      const deadline = new Date(dispute.discussion_deadline);
      const hoursUntil = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60));
      
      console.log(`   ${index + 1}. ${dispute.title}`);
      console.log(`      Chama: ${dispute.chama_name}`);
      console.log(`      Deadline: ${deadline.toLocaleString()} (${hoursUntil} hours)`);
      console.log(`      Comments: ${dispute.comment_count || 0}`);
    });

    // Check overdue disputes
    console.log('\n⏰ Checking overdue disputes...');
    const overdueVoting = await pool.query(
      `SELECT d.id, d.title, d.voting_deadline, c.name as chama_name
       FROM disputes d
       JOIN chamas c ON d.chama_id = c.id
       WHERE d.status = 'voting'
         AND d.voting_deadline IS NOT NULL
         AND d.voting_deadline < CURRENT_TIMESTAMP`,
    );

    const overdueDiscussion = await pool.query(
      `SELECT d.id, d.title, d.discussion_deadline, c.name as chama_name
       FROM disputes d
       JOIN chamas c ON d.chama_id = c.id
       WHERE d.status = 'discussion'
         AND d.discussion_deadline IS NOT NULL
         AND d.discussion_deadline < CURRENT_TIMESTAMP`,
    );

    console.log(`   Found ${overdueVoting.rows.length} overdue voting dispute(s):`);
    overdueVoting.rows.forEach((dispute, index) => {
      console.log(`   ${index + 1}. ${dispute.title} (${dispute.chama_name})`);
      console.log(`      Deadline passed: ${new Date(dispute.voting_deadline).toLocaleString()}`);
    });

    console.log(`   Found ${overdueDiscussion.rows.length} overdue discussion dispute(s):`);
    overdueDiscussion.rows.forEach((dispute, index) => {
      console.log(`   ${index + 1}. ${dispute.title} (${dispute.chama_name})`);
      console.log(`      Deadline passed: ${new Date(dispute.discussion_deadline).toLocaleString()}`);
    });

    // Check cron job status (check if DisputeReminderService is registered)
    console.log('\n⏱️  Cron Job Status:');
    console.log('   The DisputeReminderService should be running with these schedules:');
    console.log('   - Voting deadline check: Every hour (@Cron(CronExpression.EVERY_HOUR))');
    console.log('   - Discussion deadline check: Every hour (@Cron(CronExpression.EVERY_HOUR))');
    console.log('   - Overdue dispute check: Daily at 9 AM (@Cron(CronExpression.EVERY_DAY_AT_9AM))');
    console.log('\n   💡 To verify cron jobs are running, check application logs for:');
    console.log('      - "Checked X disputes with upcoming voting deadlines"');
    console.log('      - "Checked X disputes with upcoming discussion deadlines"');
    console.log('      - "Found X overdue voting disputes"');

    console.log('\n✅ Reminder check completed!');
  } catch (error: any) {
    console.error('\n❌ Reminder check failed:');
    console.error(`   Error: ${error.message}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkReminders();

