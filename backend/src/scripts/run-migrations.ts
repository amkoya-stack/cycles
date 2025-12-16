/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

interface Migration {
  id: number;
  name: string;
  filename: string;
  sql: string;
  executedAt?: Date;
}

class MigrationRunner {
  private pool: Pool;
  private migrationsPath: string;

  constructor() {
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE || 'chama_platform',
    };

    console.log(
      `🔌 Connecting to database: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`,
    );

    this.pool = new Pool(dbConfig);

    this.migrationsPath = path.join(__dirname, '..', 'migrations');
  }

  /**
   * Create migrations table if it doesn't exist
   */
  async createMigrationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await this.pool.query(query);
    console.log('✅ Migrations table created/verified');
  }

  /**
   * Get list of executed migrations
   */
  async getExecutedMigrations(): Promise<string[]> {
    try {
      const result = await this.pool.query(
        'SELECT filename FROM migrations ORDER BY id ASC',
      );
      console.log(
        `🔍 Found ${result.rows.length} executed migrations in migrations table`,
      );
      return result.rows.map((row) => row.filename);
    } catch (error) {
      console.log(`⚠️  Migrations table doesn't exist yet (${error.message})`);
      return [];
    }
  }

  /**
   * Get list of migration files
   */
  getMigrationFiles(): string[] {
    if (!fs.existsSync(this.migrationsPath)) {
      console.log('⚠️  Creating migrations directory...');
      fs.mkdirSync(this.migrationsPath, { recursive: true });
      return [];
    }

    const files = fs.readdirSync(this.migrationsPath);
    return files.filter((file) => file.endsWith('.sql')).sort();
  }

  /**
   * Run pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      console.log('🚀 Starting migration process...\n');

      // Create migrations table
      await this.createMigrationsTable();

      // Get executed migrations
      const executedMigrations = await this.getExecutedMigrations();
      console.log(`📋 Found ${executedMigrations.length} executed migrations`);

      // Get migration files
      const migrationFiles = this.getMigrationFiles();
      console.log(`📁 Found ${migrationFiles.length} migration files\n`);

      if (migrationFiles.length === 0) {
        console.log('⚠️  No migration files found in:', this.migrationsPath);
        return;
      }

      // Filter pending migrations
      const pendingMigrations = migrationFiles.filter(
        (file) => !executedMigrations.includes(file),
      );

      if (pendingMigrations.length === 0) {
        console.log('✅ No pending migrations. Database is up to date!');
        return;
      }

      console.log(
        `⏳ Running ${pendingMigrations.length} pending migrations...\n`,
      );

      // Execute each pending migration
      for (const filename of pendingMigrations) {
        await this.executeMigration(filename);
      }

      console.log('\n✅ All migrations completed successfully!');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    } finally {
      await this.pool.end();
    }
  }

  /**
   * Execute a single migration
   */
  async executeMigration(filename: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      console.log(`⏳ Executing: ${filename}`);

      // Read migration file
      const filePath = path.join(this.migrationsPath, filename);
      const sql = fs.readFileSync(filePath, 'utf8');

      // Start transaction
      await client.query('BEGIN');

      // Execute migration SQL statement-by-statement for clear error reporting
      const statements = this.splitSqlStatements(sql);

      for (const stmt of statements) {
        try {
          await client.query(stmt);
          console.log(
            `   ✅ Executed: ${stmt.substring(0, 80)}${
              stmt.length > 80 ? '…' : ''
            }`,
          );
        } catch (err) {
          console.error(`   ❌ Failed statement: ${stmt}`);
          throw err;
        }
      }

      // Record migration
      await client.query(
        'INSERT INTO migrations (name, filename) VALUES ($1, $2)',
        [filename.replace('.sql', ''), filename],
      );

      // Commit transaction
      await client.query('COMMIT');

      console.log(`✅ Completed: ${filename}\n`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Failed: ${filename}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Split SQL into executable statements while respecting:
   * - Single quotes '...'
   * - Double quotes "..."
   * - Dollar-quoted bodies $tag$ ... $tag$
   * - Line comments -- ... endline
   * - Block comments /* ... *\/ (no nesting)
   */
  private splitSqlStatements(sql: string): string[] {
    const out: string[] = [];
    let buf: string[] = [];

    let inSingle = false;
    let inDouble = false;
    let inLineComment = false;
    let inBlockComment = false;
    let dollarTag: string | null = null; // includes the surrounding $ e.g. $fn$

    const len = sql.length;
    let i = 0;
    while (i < len) {
      const ch = sql[i];
      const next = i + 1 < len ? sql[i + 1] : '';

      // Handle end of line comment
      if (inLineComment) {
        buf.push(ch);
        if (ch === '\n') {
          inLineComment = false;
        }
        i++;
        continue;
      }

      // Handle end of block comment
      if (inBlockComment) {
        buf.push(ch);
        if (ch === '*' && next === '/') {
          buf.push(next);
          i += 2;
          inBlockComment = false;
          continue;
        }
        i++;
        continue;
      }

      // Inside dollar-quoted body
      if (dollarTag) {
        // Check for closing tag
        if (ch === '$') {
          const maybe = sql.substring(i, i + dollarTag.length);
          if (maybe === dollarTag) {
            buf.push(maybe);
            i += dollarTag.length;
            dollarTag = null;
            continue;
          }
        }
        buf.push(ch);
        i++;
        continue;
      }

      // Inside single quotes
      if (inSingle) {
        buf.push(ch);
        if (ch === "'") {
          // Escaped single quote inside string: ''
          if (next === "'") {
            buf.push(next);
            i += 2;
            continue;
          }
          inSingle = false;
        }
        i++;
        continue;
      }

      // Inside double quotes
      if (inDouble) {
        buf.push(ch);
        if (ch === '"') {
          // Escaped double quote inside identifier: ""
          if (next === '"') {
            buf.push(next);
            i += 2;
            continue;
          }
          inDouble = false;
        }
        i++;
        continue;
      }

      // Not inside any quoted region/comment
      // Start of line comment
      if (ch === '-' && next === '-') {
        buf.push(ch, next);
        i += 2;
        inLineComment = true;
        continue;
      }

      // Start of block comment
      if (ch === '/' && next === '*') {
        buf.push(ch, next);
        i += 2;
        inBlockComment = true;
        continue;
      }

      // Start of single quote
      if (ch === "'") {
        buf.push(ch);
        inSingle = true;
        i++;
        continue;
      }

      // Start of double quote
      if (ch === '"') {
        buf.push(ch);
        inDouble = true;
        i++;
        continue;
      }

      // Possible start of dollar-quote $tag$
      if (ch === '$') {
        // Find next '$'
        const j = sql.indexOf('$', i + 1);
        if (j !== -1) {
          const tag = sql.substring(i, j + 1); // includes both $ ... $
          // A valid tag cannot contain another '$' inside and must start and end with '$'
          if (!tag.includes('\n') && tag.length >= 2) {
            // Assume start of dollar-quoted block
            buf.push(tag);
            dollarTag = tag;
            i = j + 1;
            continue;
          }
        }
        // Fallback: treat as normal char if not a valid tag
        buf.push(ch);
        i++;
        continue;
      }

      // Statement terminator
      if (ch === ';') {
        const stmt = buf.join('').trim();
        if (stmt.length > 0) {
          out.push(stmt);
        }
        buf = [];
        i++;
        continue;
      }

      // Default case: accumulate char
      buf.push(ch);
      i++;
    }

    const tail = buf.join('').trim();
    if (tail.length > 0) out.push(tail);
    return out;
  }

  /**
   * Rollback last migration
   */
  async rollbackLastMigration(): Promise<void> {
    try {
      console.log('🔄 Rolling back last migration...\n');

      const result = await this.pool.query(
        'SELECT * FROM migrations ORDER BY id DESC LIMIT 1',
      );

      if (result.rows.length === 0) {
        console.log('⚠️  No migrations to rollback');
        return;
      }

      const lastMigration = result.rows[0];
      console.log(`⏳ Rolling back: ${lastMigration.filename}`);

      // Check if rollback file exists
      const rollbackFilename = lastMigration.filename.replace(
        '.sql',
        '_rollback.sql',
      );
      const rollbackPath = path.join(this.migrationsPath, rollbackFilename);

      if (!fs.existsSync(rollbackPath)) {
        console.log('⚠️  No rollback file found. Skipping SQL execution.');
        console.log('   Expected file:', rollbackFilename);
      } else {
        const sql = fs.readFileSync(rollbackPath, 'utf8');
        await this.pool.query(sql);
        console.log('✅ Rollback SQL executed');
      }

      // Remove migration record
      await this.pool.query('DELETE FROM migrations WHERE id = $1', [
        lastMigration.id,
      ]);

      console.log('✅ Migration record removed\n');
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    } finally {
      await this.pool.end();
    }
  }

  /**
   * Show migration status
   */
  async showStatus(): Promise<void> {
    try {
      await this.createMigrationsTable();

      const executedMigrations = await this.getExecutedMigrations();
      const migrationFiles = this.getMigrationFiles();
      const pendingMigrations = migrationFiles.filter(
        (file) => !executedMigrations.includes(file),
      );

      console.log('\n📊 Migration Status\n');
      console.log('━'.repeat(60));
      console.log(`Total migrations:     ${migrationFiles.length}`);
      console.log(`Executed:            ${executedMigrations.length}`);
      console.log(`Pending:             ${pendingMigrations.length}`);
      console.log('━'.repeat(60));

      if (executedMigrations.length > 0) {
        console.log('\n✅ Executed Migrations:');
        executedMigrations.forEach((file, index) => {
          console.log(`   ${index + 1}. ${file}`);
        });
      }

      if (pendingMigrations.length > 0) {
        console.log('\n⏳ Pending Migrations:');
        pendingMigrations.forEach((file, index) => {
          console.log(`   ${index + 1}. ${file}`);
        });
      }

      console.log();
    } catch (error) {
      console.error('❌ Failed to show status:', error);
      throw error;
    } finally {
      await this.pool.end();
    }
  }

  /**
   * Create a new migration file
   */
  createMigrationFile(name: string): void {
    const timestamp = Date.now();
    const filename = `${timestamp}_${name}.sql`;
    const filepath = path.join(this.migrationsPath, filename);

    const template = `-- ==========================================
-- Migration: ${name}
-- Created: ${new Date().toISOString()}
-- ==========================================

-- Add your SQL here

`;

    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true });
    }

    fs.writeFileSync(filepath, template);
    console.log(`✅ Created migration file: ${filename}`);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'up';

  const runner = new MigrationRunner();

  try {
    switch (command) {
      case 'up':
        await runner.runMigrations();
        break;

      case 'down':
        await runner.rollbackLastMigration();
        break;

      case 'status':
        await runner.showStatus();
        break;

      case 'create':
        const migrationName = args[1];
        if (!migrationName) {
          console.error('❌ Please provide a migration name');
          console.log('Usage: npm run migrate:create <migration_name>');
          process.exit(1);
        }
        runner.createMigrationFile(migrationName);
        break;

      default:
        console.log('Available commands:');
        console.log('  up      - Run pending migrations');
        console.log('  down    - Rollback last migration');
        console.log('  status  - Show migration status');
        console.log('  create  - Create new migration file');
    }
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

main();
