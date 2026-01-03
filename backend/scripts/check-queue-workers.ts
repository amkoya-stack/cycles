/**
 * Check Investment Queue Workers Status
 * 
 * This script checks if queue workers are running and processing jobs.
 * Run with: npx ts-node scripts/check-queue-workers.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { InjectQueue } from '@nestjs/bull';
import { getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';

async function checkQueueWorkers() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  console.log('🔍 Checking Investment Queue Workers Status...\n');

  try {
    // Get the investment-executions queue
    const queueToken = getQueueToken('investment-executions');
    const queue = app.get<Queue>(queueToken);

    console.log('📊 Queue: investment-executions\n');

    // Get queue stats
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const completed = await queue.getCompletedCount();
    const failed = await queue.getFailedCount();
    const delayed = await queue.getDelayedCount();

    console.log('📈 Queue Statistics:');
    console.log(`   Waiting:    ${waiting}`);
    console.log(`   Active:     ${active}`);
    console.log(`   Completed:  ${completed}`);
    console.log(`   Failed:     ${failed}`);
    console.log(`   Delayed:    ${delayed}`);
    console.log(`   Total:      ${waiting + active + completed + failed + delayed}`);

    // Check if workers are processing
    if (active > 0) {
      console.log('\n✅ Workers are active and processing jobs');
    } else if (waiting > 0) {
      console.log('\n⚠️  Jobs are waiting but no active workers');
      console.log('   Make sure queue workers are running!');
    } else {
      console.log('\n✅ No jobs in queue (this is normal if no operations are pending)');
    }

    // Get recent jobs
    console.log('\n📋 Recent Jobs:');
    const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, 10);
    
    if (jobs.length === 0) {
      console.log('   No recent jobs found');
    } else {
      for (const job of jobs) {
        const state = await job.getState();
        const progress = job.progress();
        const data = job.data;
        
        console.log(`\n   Job ID: ${job.id}`);
        console.log(`   State: ${state}`);
        console.log(`   Type: ${job.name}`);
        console.log(`   Progress: ${progress}%`);
        console.log(`   Attempts: ${job.attemptsMade}/${job.opts.attempts || 'N/A'}`);
        
        if (data.investmentId) {
          console.log(`   Investment ID: ${data.investmentId}`);
        }
        if (data.idempotencyKey) {
          console.log(`   Idempotency Key: ${data.idempotencyKey}`);
        }
        
        if (job.failedReason) {
          console.log(`   ❌ Failed: ${job.failedReason}`);
        }
        
        if (job.finishedOn) {
          const duration = job.finishedOn - job.processedOn!;
          console.log(`   Duration: ${duration}ms`);
        }
      }
    }

    // Check Redis connection
    console.log('\n🔌 Redis Connection:');
    try {
      const client = (queue as any).client;
      const redisInfo = await client.info('server');
      console.log('   ✅ Redis connected');
      
      // Extract Redis version if available
      const versionMatch = redisInfo.match(/redis_version:([\d.]+)/);
      if (versionMatch) {
        console.log(`   Version: ${versionMatch[1]}`);
      }
    } catch (error: any) {
      console.log(`   ❌ Redis connection error: ${error.message}`);
    }

    console.log('\n✅ Queue check completed');
  } catch (error: any) {
    console.error('❌ Error checking queue:', error.message);
    console.error('   Make sure Redis is running and queue is properly configured');
  }

  await app.close();
}

checkQueueWorkers()
  .then(() => {
    console.log('\n✅ Check completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });

