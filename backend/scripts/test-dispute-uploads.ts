/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { config } from 'dotenv';

config();

const API_URL = process.env.API_URL || 'http://localhost:4000';
const TEST_TOKEN = process.env.TEST_TOKEN || '';

async function testFileUpload() {
  console.log('🧪 Testing Dispute File Upload...\n');

  if (!TEST_TOKEN) {
    console.error('❌ TEST_TOKEN not set in environment variables');
    console.log('Please set TEST_TOKEN in .env file or export it');
    process.exit(1);
  }

  // Create a test file
  const testFileContent = 'This is a test evidence file for dispute upload testing.';
  const testFilePath = path.join(__dirname, 'test-evidence.txt');
  fs.writeFileSync(testFilePath, testFileContent);

  try {
    // Step 1: File a dispute first
    console.log('📝 Step 1: Filing a test dispute...');
    const disputeResponse = await axios.post(
      `${API_URL}/api/v1/disputes`,
      {
        chamaId: process.env.TEST_CHAMA_ID || 'test-chama-id',
        disputeType: 'payment_dispute',
        title: 'Test Dispute for File Upload',
        description: 'This is a test dispute to verify file upload functionality',
        priority: 'normal',
      },
      {
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (disputeResponse.status !== 201 && disputeResponse.status !== 200) {
      throw new Error(`Failed to create dispute: ${disputeResponse.statusText}`);
    }

    const dispute = disputeResponse.data;
    console.log(`✅ Dispute created: ${dispute.id}\n`);

    // Step 2: Upload evidence file
    console.log('📤 Step 2: Uploading evidence file...');
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFilePath));
    formData.append('evidenceType', 'document');
    formData.append('title', 'Test Evidence File');
    formData.append('description', 'Test evidence upload');

    const uploadResponse = await axios.post(
      `${API_URL}/api/v1/disputes/${dispute.id}/evidence`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      },
    );

    if (uploadResponse.status !== 201 && uploadResponse.status !== 200) {
      throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
    }

    const evidence = uploadResponse.data;
    console.log(`✅ File uploaded successfully!`);
    console.log(`   Evidence ID: ${evidence.id}`);
    console.log(`   File URL: ${evidence.fileUrl || 'N/A'}`);
    console.log(`   File Size: ${evidence.fileSize} bytes\n`);

    // Step 3: Verify file exists
    console.log('🔍 Step 3: Verifying file...');
    const evidenceListResponse = await axios.get(
      `${API_URL}/api/v1/disputes/${dispute.id}/evidence`,
      {
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
        },
      },
    );

    const evidenceList = evidenceListResponse.data;
    console.log(`✅ Found ${evidenceList.length} evidence file(s)`);
    evidenceList.forEach((ev: any, index: number) => {
      console.log(`   ${index + 1}. ${ev.title} - ${ev.fileUrl || 'No URL'}`);
    });

    // Step 4: Check local storage (if not using S3)
    if (process.env.USE_S3_UPLOAD !== 'true') {
      console.log('\n📁 Step 4: Checking local storage...');
      const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
      const disputeUploadDir = path.join(uploadDir, 'disputes', dispute.id, 'evidence');

      if (fs.existsSync(disputeUploadDir)) {
        const files = fs.readdirSync(disputeUploadDir);
        console.log(`✅ Local storage directory exists: ${disputeUploadDir}`);
        console.log(`   Files found: ${files.length}`);
        files.forEach((file) => {
          const filePath = path.join(disputeUploadDir, file);
          const stats = fs.statSync(filePath);
          console.log(`   - ${file} (${stats.size} bytes)`);
        });
      } else {
        console.log(`⚠️  Local storage directory not found: ${disputeUploadDir}`);
        console.log('   This is normal if using S3 or if file upload failed');
      }
    } else {
      console.log('\n☁️  Step 4: Using S3 storage (skipping local check)');
    }

    console.log('\n✅ File upload test completed successfully!');
  } catch (error: any) {
    console.error('\n❌ File upload test failed:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    process.exit(1);
  } finally {
    // Cleanup test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  }
}

testFileUpload();

