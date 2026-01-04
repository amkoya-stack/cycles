/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Pool } from 'pg';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

config();

async function checkConnection() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'cycle',
  });

  try {
    console.log('🔍 Checking Database Connection After Windows Update...\n');
    console.log('═'.repeat(60));

    // 1. Check current connection details
    console.log('\n📡 Current Connection:');
    console.log(`  Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`  Port: ${process.env.DB_PORT || '5432'}`);
    console.log(`  Database: ${process.env.DB_DATABASE || 'cycle'}`);
    console.log(`  User: ${process.env.DB_USERNAME || 'postgres'}`);

    // 2. Check if we're connected to the right database
    const dbInfo = await pool.query(`
      SELECT 
        current_database() as database,
        current_user as user,
        inet_server_addr() as server_ip,
        inet_server_port() as server_port,
        version() as postgres_version
    `);
    
    console.log('\n🗄️  Connected Database Info:');
    console.log(`  Database: ${dbInfo.rows[0].database}`);
    console.log(`  User: ${dbInfo.rows[0].user}`);
    console.log(`  Server IP: ${dbInfo.rows[0].server_ip || 'localhost'}`);
    console.log(`  Server Port: ${dbInfo.rows[0].server_port || 'N/A'}`);
    console.log(`  PostgreSQL Version: ${dbInfo.rows[0].postgres_version.split(',')[0]}`);

    // 3. Check database cluster info
    const clusterInfo = await pool.query(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as db_size,
        (SELECT setting FROM pg_settings WHERE name = 'data_directory') as data_directory,
        (SELECT setting FROM pg_settings WHERE name = 'config_file') as config_file
    `);
    
    console.log('\n💾 Database Cluster Info:');
    console.log(`  Size: ${clusterInfo.rows[0].db_size}`);
    console.log(`  Data Directory: ${clusterInfo.rows[0].data_directory}`);
    console.log(`  Config File: ${clusterInfo.rows[0].config_file}`);

    // 4. List all databases
    console.log('\n📚 All Databases in Cluster:');
    const allDbs = await pool.query(`
      SELECT 
        datname,
        pg_size_pretty(pg_database_size(datname)) as size
      FROM pg_database
      WHERE datistemplate = false
      ORDER BY datname
    `);
    
    allDbs.rows.forEach((db: any) => {
      const marker = db.datname === (process.env.DB_DATABASE || 'cycle') ? ' ← CURRENT' : '';
      console.log(`  - ${db.datname} (${db.size})${marker}`);
    });

    // 5. Check if there are other databases with similar names
    const similarDbs = allDbs.rows.filter((db: any) => 
      db.datname.includes('cycle') || db.datname.includes('chama')
    );
    
    if (similarDbs.length > 1) {
      console.log('\n⚠️  WARNING: Multiple similar databases found!');
      console.log('  You might be connected to the wrong database.');
      similarDbs.forEach((db: any) => {
        console.log(`    - ${db.datname}`);
      });
    }

    // 6. Check PostgreSQL service status (Windows)
    console.log('\n🖥️  PostgreSQL Service Check:');
    console.log('  Run this command to check service status:');
    console.log('    Get-Service postgresql*');
    console.log('  Or check Services app: services.msc');

    // 7. Check for Docker
    console.log('\n🐳 Docker Check:');
    const dockerComposePath = path.join(process.cwd(), '..', 'docker-compose.yml');
    if (fs.existsSync(dockerComposePath)) {
      console.log('  ✅ docker-compose.yml found');
      console.log('  Check if Docker containers are running:');
      console.log('    docker ps');
      console.log('  Check Docker volumes:');
      console.log('    docker volume ls');
      console.log('  Check if database volume was recreated:');
      console.log('    docker volume inspect cycles_postgres_data');
    } else {
      console.log('  ℹ️  No docker-compose.yml found (using local PostgreSQL)');
    }

    // 8. Check database file modification times
    console.log('\n📅 Database Activity:');
    const activity = await pool.query(`
      SELECT 
        (SELECT MAX(created_at) FROM users) as last_user_created,
        (SELECT MAX(created_at) FROM chamas) as last_chama_created,
        (SELECT MAX(executed_at) FROM migrations) as last_migration,
        (SELECT MAX(created_at) FROM transactions) as last_transaction
    `);
    
    const act = activity.rows[0];
    console.log(`  Last user created: ${act.last_user_created?.toISOString() || 'N/A'}`);
    console.log(`  Last chama created: ${act.last_chama_created?.toISOString() || 'N/A'}`);
    console.log(`  Last migration: ${act.last_migration?.toISOString() || 'N/A'}`);
    console.log(`  Last transaction: ${act.last_transaction?.toISOString() || 'N/A'}`);

    // 9. Check for backup/restore operations
    console.log('\n💾 Backup/Restore Check:');
    console.log('  Check if database was restored from backup:');
    console.log('  - Look for backup files in: backend/backups/');
    console.log('  - Check PostgreSQL WAL (Write-Ahead Log) files');
    console.log('  - Check if point-in-time recovery was used');

    console.log('\n✅ Connection check complete\n');
    
    console.log('💡 Windows Update Impact Scenarios:');
    console.log('  1. PostgreSQL service restarted → Data should persist');
    console.log('  2. Docker container recreated → Data lost if volume not persisted');
    console.log('  3. Database connection string changed → Wrong database');
    console.log('  4. Data directory moved/changed → Data in different location');
    console.log('  5. Service account permissions changed → Can\'t access data');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkConnection();


