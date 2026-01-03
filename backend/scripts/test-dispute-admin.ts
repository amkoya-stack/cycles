/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import axios from 'axios';
import { config } from 'dotenv';

config();

const API_URL = process.env.API_URL || 'http://localhost:4000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.TEST_TOKEN || '';

async function testAdminEndpoints() {
  console.log('🧪 Testing Dispute Admin Endpoints...\n');

  if (!ADMIN_TOKEN) {
    console.error('❌ ADMIN_TOKEN or TEST_TOKEN not set in environment variables');
    process.exit(1);
  }

  try {
    // Step 1: Get escalated disputes
    console.log('📋 Step 1: Fetching escalated disputes...');
    const escalatedResponse = await axios.get(
      `${API_URL}/api/v1/admin/disputes/escalated`,
      {
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        params: {
          limit: 10,
          offset: 0,
        },
      },
    );

    const escalatedDisputes = escalatedResponse.data;
    console.log(`✅ Found ${Array.isArray(escalatedDisputes) ? escalatedDisputes.length : 0} escalated dispute(s)`);
    
    if (Array.isArray(escalatedDisputes) && escalatedDisputes.length > 0) {
      escalatedDisputes.forEach((dispute: any, index: number) => {
        console.log(`   ${index + 1}. ${dispute.title} (${dispute.id})`);
        console.log(`      Status: ${dispute.status}`);
        console.log(`      Escalated: ${dispute.escalatedAt || 'N/A'}`);
      });
    } else {
      console.log('   No escalated disputes found');
    }
    console.log('');

    // Step 2: Get dispute analytics
    console.log('📊 Step 2: Fetching dispute analytics...');
    const analyticsResponse = await axios.get(
      `${API_URL}/api/v1/admin/disputes/analytics`,
      {
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        params: {
          // Optional: startDate and endDate for date range filtering
        },
      },
    );

    const analytics = analyticsResponse.data;
    console.log('✅ Analytics retrieved:');
    console.log(`   Total Disputes: ${analytics.total || 0}`);
    console.log(`   Resolution Rate: ${(analytics.resolutionRate || 0).toFixed(2)}%`);
    console.log(`   Escalation Rate: ${(analytics.escalationRate || 0).toFixed(2)}%`);
    console.log(`   Avg Resolution Time: ${(analytics.averageResolutionTime || 0).toFixed(2)} days`);
    
    if (analytics.byType) {
      console.log('\n   By Type:');
      Object.entries(analytics.byType).forEach(([type, count]) => {
        console.log(`     ${type}: ${count}`);
      });
    }

    if (analytics.byStatus) {
      console.log('\n   By Status:');
      Object.entries(analytics.byStatus).forEach(([status, count]) => {
        console.log(`     ${status}: ${count}`);
      });
    }

    if (analytics.byPriority) {
      console.log('\n   By Priority:');
      Object.entries(analytics.byPriority).forEach(([priority, count]) => {
        console.log(`     ${priority}: ${count}`);
      });
    }

    if (analytics.trends && analytics.trends.length > 0) {
      console.log(`\n   Trends (last ${analytics.trends.length} days):`);
      analytics.trends.slice(0, 7).forEach((trend: any) => {
        console.log(`     ${trend.date}: ${trend.count} dispute(s)`);
      });
    }

    console.log('');

    // Step 3: Review an escalated dispute (if any exist)
    if (Array.isArray(escalatedDisputes) && escalatedDisputes.length > 0) {
      console.log('✍️  Step 3: Reviewing escalated dispute...');
      const disputeToReview = escalatedDisputes[0];

      const reviewResponse = await axios.put(
        `${API_URL}/api/v1/admin/disputes/${disputeToReview.id}/review`,
        {
          decision: 'Platform reviewed and resolved. Mediation recommended.',
          platformAction: {
            action: 'mediation',
            notes: 'Test review from admin endpoint',
            reviewedBy: 'admin',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${ADMIN_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log(`✅ Dispute reviewed: ${disputeToReview.id}`);
      console.log(`   Decision: ${reviewResponse.data.message || 'Success'}`);
    } else {
      console.log('⏭️  Step 3: Skipping review (no escalated disputes)');
    }

    console.log('\n✅ Admin endpoint test completed!');
  } catch (error: any) {
    console.error('\n❌ Admin endpoint test failed:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
      
      if (error.response.status === 401) {
        console.error('\n💡 Tip: Make sure you are using a platform admin token');
      }
      if (error.response.status === 403) {
        console.error('\n💡 Tip: Your user may not have platform admin role');
      }
    } else {
      console.error(`   Error: ${error.message}`);
    }
    process.exit(1);
  }
}

testAdminEndpoints();

