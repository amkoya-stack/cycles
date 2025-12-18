import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { config } from 'dotenv';

config();

const execAsync = promisify(exec);

async function backupDatabase() {
  const dbName = process.env.DB_DATABASE || 'cycle';
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5433';
  const user = process.env.DB_USERNAME || 'postgres';
  const password = process.env.DB_PASSWORD || '';

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', '..', 'backups');
  const backupFile = path.join(backupDir, `${dbName}_${timestamp}.sql`);

  // Create backups directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`📁 Created backups directory: ${backupDir}`);
  }

  console.log('💾 Creating database backup...');
  console.log(`   Database: ${dbName}`);
  console.log(`   Host: ${host}:${port}`);
  console.log(`   File: ${backupFile}\n`);

  try {
    // Set PGPASSWORD environment variable for pg_dump
    const env = { ...process.env, PGPASSWORD: password };

    // Run pg_dump command
    const command = `pg_dump -h ${host} -p ${port} -U ${user} -d ${dbName} -F p -f "${backupFile}"`;

    await execAsync(command, { env });

    const stats = fs.statSync(backupFile);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log('✅ Backup completed successfully!');
    console.log(`   File size: ${fileSizeMB} MB`);
    console.log(`   Location: ${backupFile}`);

    // Clean up old backups (keep last 10)
    const backups = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith(`${dbName}_`) && f.endsWith('.sql'))
      .map((f) => ({ name: f, path: path.join(backupDir, f) }))
      .sort(
        (a, b) =>
          fs.statSync(b.path).mtime.getTime() -
          fs.statSync(a.path).mtime.getTime(),
      );

    if (backups.length > 10) {
      console.log('\n🗑️  Cleaning up old backups...');
      const toDelete = backups.slice(10);
      for (const backup of toDelete) {
        fs.unlinkSync(backup.path);
        console.log(`   Deleted: ${backup.name}`);
      }
    }

    return backupFile;
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  backupDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { backupDatabase };
