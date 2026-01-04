import { Pool } from 'pg';
import { config } from 'dotenv';
import * as path from 'path';

config({ path: path.join(__dirname, '../../.env') });

async function testConnection() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'cycle',
  };

  console.log('\n🔍 Testing Application Database Connection:');
  console.log('═══════════════════════════════════════════════');
  console.log(`Host: ${dbConfig.host}`);
  console.log(`Port: ${dbConfig.port}`);
  console.log(`User: ${dbConfig.user}`);
  console.log(`Database: ${dbConfig.database}`);
  console.log(`Password: ${dbConfig.password ? '***' : '(not set)'}`);
  console.log('═══════════════════════════════════════════════\n');

  const pool = new Pool(dbConfig);

  try {
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Connection successful!\n');

    // Check current database
    const dbResult = await client.query('SELECT current_database() as db, current_user as user, inet_server_addr() as server_addr, inet_server_port() as server_port');
    console.log('📊 Connection Details:');
    console.log(`   Database: ${dbResult.rows[0].db}`);
    console.log(`   User: ${dbResult.rows[0].user}`);
    console.log(`   Server Address: ${dbResult.rows[0].server_addr || 'localhost'}`);
    console.log(`   Server Port: ${dbResult.rows[0].server_port || dbConfig.port}\n`);

    // Check chamas count
    const chamasResult = await client.query('SELECT COUNT(*) as count FROM chamas');
    console.log(`📈 Chamas in database: ${chamasResult.rows[0].count}`);

    // Check users count
    const usersResult = await client.query('SELECT COUNT(*) as count FROM users');
    console.log(`👥 Users in database: ${usersResult.rows[0].count}`);

    // Check members count
    const membersResult = await client.query('SELECT COUNT(*) as count FROM chama_members');
    console.log(`👤 Members in database: ${membersResult.rows[0].count}\n`);

    // List chamas
    const chamasList = await client.query('SELECT id, name, created_at FROM chamas ORDER BY created_at DESC LIMIT 5');
    console.log('📋 Recent Chamas:');
    chamasList.rows.forEach((chama, i) => {
      console.log(`   ${i + 1}. ${chama.name} (ID: ${chama.id}, Created: ${chama.created_at})`);
    });

    // Check RLS status
    const rlsResult = await client.query(`
      SELECT schemaname, tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('chamas', 'chama_members', 'users')
      ORDER BY tablename
    `);
    console.log('\n🔒 Row Level Security Status:');
    rlsResult.rows.forEach(row => {
      console.log(`   ${row.tablename}: RLS ${row.rowsecurity ? 'ENABLED' : 'DISABLED'}`);
    });

    // Check if there's a user context set
    const contextResult = await client.query(`
      SELECT current_setting('app.user_id', true) as user_id,
             current_setting('app.context', true) as context
    `);
    console.log('\n👤 Current Context:');
    console.log(`   User ID: ${contextResult.rows[0].user_id || '(not set)'}`);
    console.log(`   Context: ${contextResult.rows[0].context || '(not set)'}`);

    // Test query with system context (like the app should do)
    console.log('\n🧪 Testing with System Context:');
    await client.query('SELECT set_system_context()');
    const systemChamas = await client.query('SELECT COUNT(*) as count FROM chamas');
    console.log(`   Chamas visible with system context: ${systemChamas.rows[0].count}`);

    // Test query with a user context
    const testUser = await client.query('SELECT id FROM users LIMIT 1');
    if (testUser.rows.length > 0) {
      const userId = testUser.rows[0].id;
      console.log(`\n🧪 Testing with User Context (${userId}):`);
      await client.query('SELECT set_user_context($1)', [userId]);
      const userChamas = await client.query(`
        SELECT COUNT(*) as count 
        FROM chamas c
        JOIN chama_members cm ON c.id = cm.chama_id
        WHERE cm.user_id = $1 AND cm.status IN ('active', 'suspended')
      `, [userId]);
      console.log(`   Chamas visible to user: ${userChamas.rows[0].count}`);
    }

    client.release();
    await pool.end();
    console.log('\n✅ Test completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Connection failed:', error);
    await pool.end();
    process.exit(1);
  }
}

testConnection();

