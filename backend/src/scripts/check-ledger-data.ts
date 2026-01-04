/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Pool } from 'pg';
import { config } from 'dotenv';

config();

async function checkLedger() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'cycle',
  });

  try {
    console.log('💰 Checking Ledger Data...\n');
    console.log('═'.repeat(60));

    // 1. Check accounts
    console.log('\n📊 Accounts:');
    console.log('─'.repeat(60));
    const accountsCount = await pool.query('SELECT COUNT(*) as count FROM accounts');
    console.log(`  Total accounts: ${accountsCount.rows[0].count}`);

    if (parseInt(accountsCount.rows[0].count) > 0) {
      const accounts = await pool.query(`
        SELECT 
          a.id, 
          a.account_number, 
          a.name, 
          at.category as type,
          a.balance,
          a.user_id,
          a.chama_id,
          a.created_at
        FROM accounts a
        LEFT JOIN account_types at ON a.account_type_id = at.id
        ORDER BY a.created_at DESC 
        LIMIT 10
      `);
      console.log('\n  Recent accounts:');
      accounts.rows.forEach((acc: any) => {
        const owner = acc.user_id ? `User: ${acc.user_id.substring(0, 8)}...` : 
                     acc.chama_id ? `Chama: ${acc.chama_id.substring(0, 8)}...` : 
                     'System';
        console.log(`    - ${acc.account_number} (${acc.name}) - ${acc.type || 'N/A'}`);
        console.log(`      Balance: ${acc.balance || 0} | ${owner}`);
        console.log(`      Created: ${acc.created_at?.toISOString() || 'N/A'}`);
      });

      // Check total balances
      const totalBalance = await pool.query(`
        SELECT 
          SUM(a.balance) FILTER (WHERE at.category = 'asset') as total_assets,
          SUM(a.balance) FILTER (WHERE at.category = 'liability') as total_liabilities,
          SUM(a.balance) FILTER (WHERE at.category = 'equity') as total_equity,
          SUM(a.balance) FILTER (WHERE at.category = 'revenue') as total_revenue,
          SUM(a.balance) FILTER (WHERE at.category = 'expense') as total_expense
        FROM accounts a
        LEFT JOIN account_types at ON a.account_type_id = at.id
      `);
      console.log('\n  Account Type Totals:');
      console.log(`    Assets: ${totalBalance.rows[0].total_assets || 0}`);
      console.log(`    Liabilities: ${totalBalance.rows[0].total_liabilities || 0}`);
      console.log(`    Equity: ${totalBalance.rows[0].total_equity || 0}`);
      console.log(`    Revenue: ${totalBalance.rows[0].total_revenue || 0}`);
      console.log(`    Expense: ${totalBalance.rows[0].total_expense || 0}`);
    }

    // 2. Check transactions
    console.log('\n💸 Transactions:');
    console.log('─'.repeat(60));
    const txnCount = await pool.query('SELECT COUNT(*) as count FROM transactions');
    console.log(`  Total transactions: ${txnCount.rows[0].count}`);

    if (parseInt(txnCount.rows[0].count) > 0) {
      const recentTxns = await pool.query(`
        SELECT 
          id, 
          code, 
          description, 
          amount,
          status,
          created_at
        FROM transactions 
        ORDER BY created_at DESC 
        LIMIT 10
      `);
      console.log('\n  Recent transactions:');
      recentTxns.rows.forEach((txn: any) => {
        console.log(`    - ${txn.code} - ${txn.description || 'N/A'}`);
        console.log(`      Amount: ${txn.amount || 0} | Status: ${txn.status}`);
        console.log(`      Created: ${txn.created_at?.toISOString() || 'N/A'}`);
      });

      // Check transaction totals
      const txnTotals = await pool.query(`
        SELECT 
          COUNT(*) as count,
          SUM(amount) FILTER (WHERE status = 'completed') as total_completed,
          MIN(created_at) as first_txn,
          MAX(created_at) as last_txn
        FROM transactions
      `);
      console.log('\n  Transaction Summary:');
      console.log(`    Total: ${txnTotals.rows[0].count}`);
      console.log(`    Completed Total: ${txnTotals.rows[0].total_completed || 0}`);
      console.log(`    First: ${txnTotals.rows[0].first_txn?.toISOString() || 'N/A'}`);
      console.log(`    Last: ${txnTotals.rows[0].last_txn?.toISOString() || 'N/A'}`);
    }

    // 3. Check entries
    console.log('\n📝 Ledger Entries:');
    console.log('─'.repeat(60));
    const entriesCount = await pool.query('SELECT COUNT(*) as count FROM entries');
    console.log(`  Total entries: ${entriesCount.rows[0].count}`);

    if (parseInt(entriesCount.rows[0].count) > 0) {
      const entryTotals = await pool.query(`
        SELECT 
          SUM(amount) FILTER (WHERE type = 'debit') as total_debits,
          SUM(amount) FILTER (WHERE type = 'credit') as total_credits
        FROM entries
      `);
      console.log(`  Total Debits: ${entryTotals.rows[0].total_debits || 0}`);
      console.log(`  Total Credits: ${entryTotals.rows[0].total_credits || 0}`);
      console.log(`  Balance Check: ${(parseFloat(entryTotals.rows[0].total_debits || 0) - parseFloat(entryTotals.rows[0].total_credits || 0)) === 0 ? '✅ Balanced' : '❌ Imbalanced'}`);
    }

    // 4. Check chama wallets specifically
    console.log('\n🏦 Chama Wallets:');
    console.log('─'.repeat(60));
    const chamaWallets = await pool.query(`
      SELECT 
        a.id,
        a.account_number,
        a.name,
        a.balance,
        a.chama_id,
        a.created_at
      FROM accounts a
      WHERE a.chama_id IS NOT NULL
      ORDER BY a.created_at DESC
    `);
    console.log(`  Total chama wallets: ${chamaWallets.rows.length}`);
    if (chamaWallets.rows.length > 0) {
      chamaWallets.rows.forEach((wallet: any) => {
        console.log(`    - ${wallet.account_number} (${wallet.name})`);
        console.log(`      Balance: ${wallet.balance || 0} | Chama: ${wallet.chama_id?.substring(0, 8)}...`);
        console.log(`      Created: ${wallet.created_at?.toISOString() || 'N/A'}`);
      });
    }

    // 5. Check user wallets
    console.log('\n👤 User Wallets:');
    console.log('─'.repeat(60));
    const userWallets = await pool.query(`
      SELECT 
        a.id,
        a.account_number,
        a.name,
        a.balance,
        a.user_id,
        a.created_at,
        at.category as type
      FROM accounts a
      LEFT JOIN account_types at ON a.account_type_id = at.id
      WHERE a.user_id IS NOT NULL AND at.category = 'asset'
      ORDER BY a.created_at DESC
      LIMIT 10
    `);
    console.log(`  Total user wallets: ${userWallets.rows.length}`);
    if (userWallets.rows.length > 0) {
      userWallets.rows.forEach((wallet: any) => {
        console.log(`    - ${wallet.account_number} (${wallet.name})`);
        console.log(`      Balance: ${wallet.balance || 0} | User: ${wallet.user_id?.substring(0, 8)}...`);
        console.log(`      Created: ${wallet.created_at?.toISOString() || 'N/A'}`);
      });
    }

    // 6. Check current date/time
    console.log('\n🕐 System Time:');
    console.log('─'.repeat(60));
    const now = await pool.query('SELECT NOW() as current_time, CURRENT_DATE as current_date');
    console.log(`  Database Time: ${now.rows[0].current_time.toISOString()}`);
    console.log(`  Database Date: ${now.rows[0].current_date.toISOString()}`);

    console.log('\n✅ Ledger check complete\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkLedger();

