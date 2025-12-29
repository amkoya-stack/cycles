/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { WalletService } from './wallet.service';

@Controller({ path: 'wallet', version: '1' })
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  /**
   * Get wallet balance
   * GET /api/wallet/balance
   */
  @Get('balance')
  async getBalance(@Req() req: any) {
    const balance = await this.wallet.getBalance(req.user.id);
    return { balance };
  }

  /**
   * Initiate deposit via M-Pesa
   * POST /api/wallet/deposit
   */
  @Post('deposit')
  async deposit(
    @Req() req: any,
    @Body()
    body: { phoneNumber: string; amount: number; idempotencyKey?: string },
  ) {
    const result = await this.wallet.initiateDeposit(req.user.id, {
      phoneNumber: body.phoneNumber,
      amount: body.amount,
      idempotencyKey: body.idempotencyKey,
    });
    return result;
  }

  /**
   * Initiate withdrawal to M-Pesa
   * POST /api/wallet/withdraw
   */
  @Post('withdraw')
  async withdraw(
    @Req() req: any,
    @Body()
    body: { phoneNumber: string; amount: number; idempotencyKey?: string },
  ) {
    const result = await this.wallet.initiateWithdrawal(req.user.id, {
      phoneNumber: body.phoneNumber,
      amount: body.amount,
      idempotencyKey: body.idempotencyKey,
    });
    return result;
  }

  /**
   * Internal wallet transfer
   * POST /api/wallet/transfer
   */
  @Post('transfer')
  async transfer(
    @Req() req: any,
    @Body()
    body: {
      recipientPhone: string;
      amount: number;
      description?: string;
      idempotencyKey?: string;
    },
  ) {
    const result = await this.wallet.transfer(req.user.id, {
      recipientPhone: body.recipientPhone,
      amount: body.amount,
      description: body.description,
      idempotencyKey: body.idempotencyKey,
    });
    return result;
  }

  /**
   * Get transaction history
   * GET /api/wallet/transactions?startDate=2024-01-01&type=deposit&limit=50
   */
  @Get('transactions')
  async getTransactions(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const filters: any = {};
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (type) filters.type = type;
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    const result = await this.wallet.getTransactionHistory(
      req.user.id,
      filters,
    );
    return result;
  }

  /**
   * Get transaction details
   * GET /api/wallet/transactions/:id
   */
  @Get('transactions/:id')
  async getTransactionDetails(
    @Req() req: any,
    @Param('id') transactionId: string,
  ) {
    const result = await this.wallet.getTransactionDetails(
      req.user.id,
      transactionId,
    );
    return result;
  }

  /**
   * Generate account statement
   * GET /api/wallet/statement?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&format=pdf|csv
   */
  @Get('statement')
  async getStatement(
    @Req() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('format') format: 'pdf' | 'csv' = 'pdf',
  ) {
    const result = await this.wallet.generateStatement(req.user.id, {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      format,
    });
    return result;
  }

  /**
   * Check deposit status
   * GET /api/wallet/deposit/status/:checkoutRequestId
   */
  @Get('deposit/status/:checkoutRequestId')
  async checkDepositStatus(
    @Req() req: any,
    @Param('checkoutRequestId') checkoutRequestId: string,
  ) {
    const result = await this.wallet.checkDepositStatus(
      req.user.id,
      checkoutRequestId,
    );
    return result;
  }

  /**
   * Get failed transactions that may need refunds
   * GET /api/wallet/failed-transactions
   */
  @Get('failed-transactions')
  async getFailedTransactions(@Req() req: any) {
    const result = await this.wallet.getFailedTransactions(req.user.id);
    return result;
  }

  /**
   * Request refund for a failed transaction
   * POST /api/wallet/refund/:callbackId
   */
  @Post('refund/:callbackId')
  async requestRefund(
    @Req() req: any,
    @Param('callbackId') callbackId: string,
  ) {
    const result = await this.wallet.requestRefund(req.user.id, callbackId);
    return result;
  }

  /**
   * Create a fund request
   * POST /api/wallet/request
   */
  @Post('request')
  async createFundRequest(
    @Req() req: any,
    @Body()
    body: {
      amount: number;
      description?: string;
      recipientId?: string;
      chamaId?: string;
      requestType: 'member' | 'chama';
    },
  ) {
    const result = await this.wallet.createFundRequest(req.user.id, body);
    return result;
  }

  /**
   * Get fund requests received by the user
   * GET /api/wallet/requests/received
   */
  @Get('requests/received')
  async getReceivedFundRequests(
    @Req() req: any,
    @Query('status') status?: string,
  ) {
    const result = await this.wallet.getFundRequests(req.user.id, status);
    return result;
  }

  /**
   * Get fund requests sent by the user
   * GET /api/wallet/requests/sent
   */
  @Get('requests/sent')
  async getSentFundRequests(@Req() req: any) {
    const result = await this.wallet.getSentFundRequests(req.user.id);
    return result;
  }

  /**
   * Respond to a fund request (approve/decline)
   * POST /api/wallet/requests/:requestId/respond
   */
  @Post('requests/:requestId/respond')
  async respondToFundRequest(
    @Req() req: any,
    @Param('requestId') requestId: string,
    @Body() body: { action: 'approve' | 'decline' },
  ) {
    const result = await this.wallet.respondToFundRequest(
      req.user.id,
      requestId,
      body.action,
    );
    return result;
  }

  /**
   * Get fund request notifications
   * GET /api/wallet/notifications
   */
  @Get('notifications')
  async getFundRequestNotifications(
    @Req() req: any,
    @Query('isRead') isRead?: string,
  ) {
    const isReadBool =
      isRead === 'true' ? true : isRead === 'false' ? false : undefined;
    const result = await this.wallet.getFundRequestNotifications(
      req.user.id,
      isReadBool,
    );
    return result;
  }

  /**
   * Mark notification as read
   * POST /api/wallet/notifications/:notificationId/read
   */
  @Post('notifications/:notificationId/read')
  async markNotificationAsRead(
    @Req() req: any,
    @Param('notificationId') notificationId: string,
  ) {
    const result = await this.wallet.markNotificationAsRead(
      req.user.id,
      notificationId,
    );
    return result;
  }
}
