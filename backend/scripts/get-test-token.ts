/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import axios from 'axios';
import { config } from 'dotenv';
import * as readline from 'readline';

config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function getTestToken() {
  console.log('🔑 Get Test Token for Dispute Testing\n');

  const API_URL = process.env.API_URL || 'http://localhost:4000';

  try {
    const email = await question('Email: ');
    const password = await question('Password: ');

    console.log('\n📡 Logging in...');

    const response = await axios.post(
      `${API_URL}/api/v1/auth/login`,
      {
        email,
        password,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (response.data.accessToken) {
      const token = response.data.accessToken;
      console.log('\n✅ Login successful!');
      console.log('\n📋 Your JWT Token:');
      console.log(token);
      console.log('\n💡 Add this to your .env file:');
      console.log(`TEST_TOKEN=${token}`);

      // Try to get user info
      try {
        const userResponse = await axios.get(
          `${API_URL}/api/v1/auth/profile`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const user = userResponse.data;
        console.log('\n👤 User Info:');
        console.log(`   Name: ${user.full_name || user.name || 'N/A'}`);
        console.log(`   Email: ${user.email || 'N/A'}`);
        console.log(`   ID: ${user.id || user.user_id || 'N/A'}`);

        // Try to get user's chamas
        try {
          const chamasResponse = await axios.get(
            `${API_URL}/api/v1/chama`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );

          const chamas = Array.isArray(chamasResponse.data) ? chamasResponse.data : [];
          if (chamas.length > 0) {
            console.log('\n🏛️  Your Chamas:');
            chamas.forEach((chama: any, index: number) => {
              console.log(`   ${index + 1}. ${chama.name} (ID: ${chama.id})`);
              if (chama.user_role) {
                console.log(`      Role: ${chama.user_role}`);
              }
            });
            console.log('\n💡 Add a chama ID to your .env file:');
            console.log(`TEST_CHAMA_ID=${chamas[0].id}`);
          }
        } catch (err) {
          console.log('\n⚠️  Could not fetch chamas (may need to join a chama first)');
        }
      } catch (err) {
        console.log('\n⚠️  Could not fetch user profile');
      }
    } else {
      console.error('\n❌ Login failed: No token received');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Login failed:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

getTestToken();

