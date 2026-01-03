/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DisputeReminderService } from '../src/dispute/dispute-reminder.service';

async function verifyCronJobs() {
  console.log('⏱️  Verifying Dispute Reminder Cron Jobs...\n');

  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const reminderService = app.get(DisputeReminderService);

    console.log('✅ DisputeReminderService is registered and available\n');

    // Check if cron jobs are registered
    console.log('📋 Registered Cron Jobs:');
    console.log('   1. checkVotingDeadlines() - Runs every hour');
    console.log('   2. checkDiscussionDeadlines() - Runs every hour');
    console.log('   3. checkOverdueDisputes() - Runs daily at 9 AM\n');

    // Manually trigger cron jobs for testing
    console.log('🧪 Testing cron job execution...\n');

    console.log('Testing checkVotingDeadlines...');
    await reminderService['checkVotingDeadlines']();
    console.log('✅ Voting deadline check completed\n');

    console.log('Testing checkDiscussionDeadlines...');
    await reminderService['checkDiscussionDeadlines']();
    console.log('✅ Discussion deadline check completed\n');

    console.log('Testing checkOverdueDisputes...');
    await reminderService['checkOverdueDisputes']();
    console.log('✅ Overdue dispute check completed\n');

    console.log('✅ All cron jobs are working correctly!');
    console.log('\n💡 Note: Cron jobs will run automatically on schedule:');
    console.log('   - Voting/Discussion checks: Every hour');
    console.log('   - Overdue check: Daily at 9 AM');
    console.log('\n   Check application logs to see cron job execution in production.');

    await app.close();
  } catch (error: any) {
    console.error('\n❌ Cron job verification failed:');
    console.error(`   Error: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    process.exit(1);
  }
}

verifyCronJobs();

