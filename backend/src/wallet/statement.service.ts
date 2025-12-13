/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

export interface StatementRequest {
  userId: string;
  startDate: Date;
  endDate: Date;
  format?: 'pdf' | 'csv';
}

@Injectable()
export class StatementService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Generate PDF statement for user's transactions
   */
  async generatePDFStatement(request: StatementRequest): Promise<Buffer> {
    // Set user context for RLS
    await this.db.setUserContext(request.userId);

    // Get user details
    const userResult = await this.db.query(
      'SELECT email, phone, first_name, last_name FROM users WHERE id = $1',
      [request.userId],
    );
    const user = userResult.rows[0];

    // Get account balance
    const accountResult = await this.db.query(
      "SELECT balance FROM accounts WHERE user_id = $1 AND status = 'active' LIMIT 1",
      [request.userId],
    );
    const currentBalance =
      accountResult.rows.length > 0
        ? Math.abs(accountResult.rows[0].balance)
        : 0;

    // Get transactions
    const transactionsResult = await this.db.query(
      `SELECT 
        t.reference,
        t.description,
        t.status,
        t.created_at,
        t.completed_at,
        tc.name as transaction_type,
        e.amount,
        e.direction,
        e.balance_after
      FROM transactions t
      JOIN transaction_codes tc ON t.code_id = tc.id
      JOIN entries e ON t.id = e.transaction_id
      JOIN accounts a ON e.account_id = a.id
      WHERE a.user_id = $1
        AND t.created_at >= $2
        AND t.created_at <= $3
        AND t.status = 'completed'
      ORDER BY t.created_at ASC`,
      [request.userId, request.startDate, request.endDate],
    );

    await this.db.clearContext();

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));

    // Header
    doc.fontSize(20).text('Cycle Platform', { align: 'center' });
    doc.fontSize(16).text('Account Statement', { align: 'center' });
    doc.moveDown();

    // User details
    doc.fontSize(10);
    doc.text(
      `Account Holder: ${user.first_name || ''} ${user.last_name || ''}`.trim(),
    );
    doc.text(`Email: ${user.email || 'N/A'}`);
    doc.text(`Phone: ${user.phone || 'N/A'}`);
    doc.text(
      `Statement Period: ${request.startDate.toDateString()} - ${request.endDate.toDateString()}`,
    );
    doc.text(`Current Balance: KES ${currentBalance.toFixed(2)}`);
    doc.moveDown();

    // Transactions table header
    doc.fontSize(9).font('Helvetica-Bold');
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 150;
    const col3 = 280;
    const col4 = 380;
    const col5 = 480;

    doc.text('Date', col1, tableTop);
    doc.text('Description', col2, tableTop);
    doc.text('Type', col3, tableTop);
    doc.text('Amount', col4, tableTop);
    doc.text('Balance', col5, tableTop);

    doc
      .moveTo(col1, doc.y + 5)
      .lineTo(550, doc.y + 5)
      .stroke();
    doc.moveDown();

    // Transactions data
    doc.font('Helvetica');
    let runningBalance = 0;

    for (const tx of transactionsResult.rows) {
      const date = new Date(tx.created_at).toLocaleDateString();
      const description = tx.description.substring(0, 25);
      const type = tx.transaction_type;
      const amount = tx.direction === 'credit' ? tx.amount : -tx.amount;
      runningBalance = Math.abs(tx.balance_after);

      const y = doc.y;
      doc.text(date, col1, y, { width: 90 });
      doc.text(description, col2, y, { width: 120 });
      doc.text(type, col3, y, { width: 90 });
      doc.text(
        amount >= 0 ? `+${amount.toFixed(2)}` : amount.toFixed(2),
        col4,
        y,
        { width: 90 },
      );
      doc.text(runningBalance.toFixed(2), col5, y, { width: 80 });

      doc.moveDown(0.5);

      // Add new page if needed
      if (doc.y > 700) {
        doc.addPage();
      }
    }

    // Summary
    doc.moveDown();
    doc.moveTo(col1, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
    doc.font('Helvetica-Bold');
    doc.text(`Total Transactions: ${transactionsResult.rows.length}`);
    doc.text(`Closing Balance: KES ${currentBalance.toFixed(2)}`);

    // Footer
    doc
      .fontSize(8)
      .font('Helvetica')
      .text(`Generated on ${new Date().toLocaleString()}`, 50, 750, {
        align: 'center',
      });

    doc.end();

    // Wait for PDF generation to complete
    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }

  /**
   * Generate CSV statement
   */
  async generateCSVStatement(request: StatementRequest): Promise<string> {
    await this.db.setUserContext(request.userId);

    const transactionsResult = await this.db.query(
      `SELECT 
        t.reference,
        t.description,
        t.status,
        t.created_at,
        t.completed_at,
        tc.name as transaction_type,
        e.amount,
        e.direction,
        e.balance_after
      FROM transactions t
      JOIN transaction_codes tc ON t.code_id = tc.id
      JOIN entries e ON t.id = e.transaction_id
      JOIN accounts a ON e.account_id = a.id
      WHERE a.user_id = $1
        AND t.created_at >= $2
        AND t.created_at <= $3
        AND t.status = 'completed'
      ORDER BY t.created_at ASC`,
      [request.userId, request.startDate, request.endDate],
    );

    await this.db.clearContext();

    // Build CSV
    let csv = 'Date,Reference,Description,Type,Amount,Balance\n';

    for (const tx of transactionsResult.rows) {
      const date = new Date(tx.created_at).toISOString();
      const amount = tx.direction === 'credit' ? tx.amount : -tx.amount;
      const balance = Math.abs(tx.balance_after);

      csv += `${date},${tx.reference},"${tx.description}",${tx.transaction_type},${amount},${balance}\n`;
    }

    return csv;
  }
}
