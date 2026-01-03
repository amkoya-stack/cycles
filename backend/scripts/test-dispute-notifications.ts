/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import axios from 'axios';
import { config } from 'dotenv';

config();

const API_URL = process.env.API_URL || 'http://localhost:4000';
const TEST_TOKEN = process.env.TEST_TOKEN || '';
const TEST_CHAMA_ID = process.env.TEST_CHAMA_ID || '';

async function testNotifications() {
  console.log('🧪 Testing Dispute Notifications...\n');

  if (!TEST_TOKEN) {
    console.error('❌ TEST_TOKEN not set in environment variables');
    process.exit(1);
  }

  if (!TEST_CHAMA_ID) {
    console.error('❌ TEST_CHAMA_ID not set in environment variables');
    process.exit(1);
  }

  try {
    // Step 1: File a dispute (should trigger "dispute filed" notification)
    console.log('📝 Step 1: Filing a dispute to test notifications...');
    const disputeResponse = await axios.post(
      `${API_URL}/api/v1/disputes`,
      {
        chamaId: TEST_CHAMA_ID,
        disputeType: 'payment_dispute',
        title: 'Test Dispute for Notifications',
        description: 'This dispute is created to test notification delivery',
        priority: 'high',
      },
      {
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const dispute = disputeResponse.data;
    console.log(`✅ Dispute created: ${dispute.id}`);
    console.log('   → Check email inboxes of chama members');
    console.log('   → Check push notifications on devices\n');

    // Step 2: Add evidence (should trigger "evidence added" notification)
    console.log('📎 Step 2: Adding evidence...');
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

    const evidenceResponse = await axios.post(
      `${API_URL}/api/v1/disputes/${dispute.id}/evidence`,
      {
        evidenceType: 'document',
        title: 'Test Evidence',
        description: 'Test evidence for notification testing',
      },
      {
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    console.log(`✅ Evidence added: ${evidenceResponse.data.id}`);
    console.log('   → Check email inboxes of dispute participants\n');

    // Step 3: Add comment (should trigger "comment added" notification)
    console.log('💬 Step 3: Adding comment...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const commentResponse = await axios.post(
      `${API_URL}/api/v1/disputes/${dispute.id}/comments`,
      {
        content: 'This is a test comment to verify notification delivery',
      },
      {
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    console.log(`✅ Comment added: ${commentResponse.data.id}`);
    console.log('   → Check push notifications on devices\n');

    // Step 4: Start voting (should trigger "voting started" notification)
    console.log('🗳️  Step 4: Starting voting phase...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const votingDeadline = new Date();
    votingDeadline.setDate(votingDeadline.getDate() + 3); // 3 days from now

    const votingResponse = await axios.put(
      `${API_URL}/api/v1/disputes/${dispute.id}/start-voting`,
      {
        votingDeadline: votingDeadline.toISOString(),
      },
      {
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    console.log(`✅ Voting started`);
    console.log(`   Deadline: ${votingDeadline.toLocaleString()}`);
    console.log('   → Check email inboxes of all chama members');
    console.log('   → Check push notifications with voting reminders\n');

    // Step 5: Resolve dispute (should trigger "dispute resolved" notification)
    console.log('✅ Step 5: Resolving dispute...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const resolveResponse = await axios.put(
      `${API_URL}/api/v1/disputes/${dispute.id}/resolve`,
      {
        resolutionType: 'mediation',
        resolutionDetails: {
          outcome: 'Test resolution',
          notes: 'This is a test resolution for notification testing',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    console.log(`✅ Dispute resolved`);
    console.log('   → Check email inboxes of dispute participants\n');

    console.log('✅ Notification test completed!');
    console.log('\n📋 Summary:');
    console.log('   - Dispute filed notification sent to all members');
    console.log('   - Evidence added notification sent to participants');
    console.log('   - Comment added notification sent to participants');
    console.log('   - Voting started notification sent to all members');
    console.log('   - Dispute resolved notification sent to participants');
    console.log('\n💡 Check your email inboxes and push notification logs to verify delivery');
  } catch (error: any) {
    console.error('\n❌ Notification test failed:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    process.exit(1);
  }
}

testNotifications();

