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

@Controller('wallet')
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
    @Body() body: { phoneNumber: string; amount: number },
  ) {
    const result = await this.wallet.initiateDeposit(req.user.id, {
      phoneNumber: body.phoneNumber,
      amount: body.amount,
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
    @Body() body: { phoneNumber: string; amount: number },
  ) {
    const result = await this.wallet.initiateWithdrawal(req.user.id, {
      phoneNumber: body.phoneNumber,
      amount: body.amount,
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
    body: { recipientPhone: string; amount: number; description?: string },
  ) {
    const result = await this.wallet.transfer(req.user.id, {
      recipientPhone: body.recipientPhone,
      amount: body.amount,
      description: body.description,
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
}
