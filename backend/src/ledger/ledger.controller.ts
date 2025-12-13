/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// LEDGER CONTROLLER
// ==========================================

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { LedgerService } from './ledger.service';
import {
  DepositDto,
  WithdrawalDto,
  TransferDto,
  ContributionDto,
  PayoutDto,
  CreateWalletDto,
  AccountStatementDto,
} from './dto/index';

@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  // ==========================================
  // WALLET/ACCOUNT OPERATIONS
  // ==========================================

  @Post('wallets')
  async createWallet(@Body() createWalletDto: CreateWalletDto) {
    if (createWalletDto.ownerType === 'user') {
      return await this.ledgerService.createUserWallet(
        createWalletDto.ownerId,
        createWalletDto.ownerName,
      );
    } else if (createWalletDto.ownerType === 'chama') {
      return await this.ledgerService.createChamaWallet(
        createWalletDto.ownerId,
        createWalletDto.ownerName,
      );
    } else {
      throw new BadRequestException('Invalid owner type');
    }
  }

  @Get('accounts/user/:userId')
  async getUserAccount(@Param('userId') userId: string) {
    return await this.ledgerService.getUserAccount(userId);
  }

  @Get('accounts/chama/:chamaId')
  async getChamaAccount(@Param('chamaId') chamaId: string) {
    return await this.ledgerService.getChamaAccount(chamaId);
  }

  @Get('accounts/:accountId/balance')
  async getAccountBalance(@Param('accountId') accountId: string) {
    const balance = await this.ledgerService.getAccountBalance(accountId);
    return { accountId, balance };
  }

  @Get('accounts/:accountId/statement')
  async getAccountStatement(
    @Param('accountId') accountId: string,
    @Query() query: AccountStatementDto,
  ) {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return await this.ledgerService.getAccountStatement(
      accountId,
      startDate,
      endDate,
    );
  }

  // ==========================================
  // TRANSACTION OPERATIONS
  // ==========================================

  @Post('transactions/deposit')
  async deposit(@Body() depositDto: DepositDto, @Request() req: any) {
    // Prefer authenticated user; fallback to body for testing
    const userIdSource = req.user?.id ?? depositDto.userId;
    const userId = typeof userIdSource === 'string' ? userIdSource : undefined;

    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    return await this.ledgerService.processDeposit(
      userId,
      depositDto.amount,
      depositDto.externalReference,
      depositDto.description,
    );
  }

  @Post('transactions/withdrawal')
  async withdrawal(@Body() withdrawalDto: WithdrawalDto, @Request() req: any) {
    const userIdSource = req.user?.id ?? withdrawalDto.userId;
    const userId = typeof userIdSource === 'string' ? userIdSource : undefined;

    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    return await this.ledgerService.processWithdrawal(
      userId,
      withdrawalDto.amount,
      withdrawalDto.destinationAccount,
      withdrawalDto.description,
    );
  }

  @Post('transactions/transfer')
  async transfer(@Body() transferDto: TransferDto, @Request() req: any) {
    const senderSource = req.user?.id ?? transferDto.senderUserId;
    const senderUserId =
      typeof senderSource === 'string' ? senderSource : undefined;

    if (!senderUserId) {
      throw new BadRequestException('Sender user ID is required');
    }

    return await this.ledgerService.processTransfer(
      senderUserId,
      transferDto.receiverUserId,
      transferDto.amount,
      transferDto.description,
    );
  }

  @Post('transactions/contribution')
  async contribution(
    @Body() contributionDto: ContributionDto,
    @Request() req: any,
  ) {
    const userIdSource = req.user?.id ?? contributionDto.userId;
    const userId = typeof userIdSource === 'string' ? userIdSource : undefined;

    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    return await this.ledgerService.processContribution(
      userId,
      contributionDto.chamaId,
      contributionDto.amount,
      contributionDto.description,
    );
  }

  @Post('transactions/payout')
  async payout(@Body() payoutDto: PayoutDto, @Request() req: any) {
    const chamaIdSource = req.body?.chamaId;
    const chamaId =
      typeof chamaIdSource === 'string' ? chamaIdSource : undefined;

    if (!chamaId) {
      throw new BadRequestException('Chama ID is required');
    }

    return await this.ledgerService.processPayout(
      chamaId,
      payoutDto.userId,
      payoutDto.amount,
      payoutDto.description,
    );
  }

  @Get('transactions/:transactionId')
  async getTransaction(@Param('transactionId') transactionId: string) {
    return await this.ledgerService.getTransaction(transactionId);
  }

  // ==========================================
  // REPORTING & AUDIT
  // ==========================================

  @Get('balance-check')
  async checkLedgerBalance() {
    return await this.ledgerService.checkLedgerBalance();
  }
}
