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
  UseGuards,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { LedgerService } from './ledger.service';
import {
  GovernanceService,
  ProposalType,
  VotingType,
} from '../governance/governance.service';
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
  constructor(
    private readonly ledgerService: LedgerService,
    @Inject(forwardRef(() => GovernanceService))
    private readonly governanceService: GovernanceService,
  ) {}

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
  // CHAMA WALLET OPERATIONS
  // ==========================================

  /**
   * Deposit directly to chama wallet from external source
   * POST /api/ledger/chama/:chamaId/deposit
   */
  @Post('chama/:chamaId/deposit')
  @UseGuards(JwtAuthGuard)
  async chamaDeposit(
    @Param('chamaId') chamaId: string,
    @Body()
    depositDto: {
      amount: number;
      sourceType: 'mpesa' | 'bank' | 'cash' | 'other';
      sourceReference: string;
      description: string;
      sourceDetails?: Record<string, any>;
    },
    @Request() req: any,
  ) {
    return await this.ledgerService.processChamaDeposit(
      chamaId,
      depositDto.amount,
      req.user.id,
      depositDto.sourceType,
      depositDto.sourceReference,
      depositDto.description,
      depositDto.sourceDetails,
    );
  }

  /**
   * Transfer from chama wallet - Creates a proposal that requires voting
   * POST /api/ledger/chama/:chamaId/transfer
   *
   * Supports multiple destination types:
   * - chama: Transfer to another chama wallet
   * - user: Transfer to a user's wallet
   * - mpesa: Transfer to M-Pesa number (external)
   * - bank: Transfer to bank account (external)
   *
   * The actual transfer is only executed after the proposal passes and is executed
   */
  @Post('chama/:chamaId/transfer')
  @UseGuards(JwtAuthGuard)
  async chamaTransfer(
    @Param('chamaId') sourceChamaId: string,
    @Body()
    transferDto: {
      // Destination type - required
      destinationType: 'chama' | 'user' | 'mpesa' | 'bank';
      // For chama transfers
      destinationChamaId?: string;
      destinationChamaName?: string;
      // For user transfers
      destinationUserId?: string;
      destinationUserName?: string;
      // For M-Pesa transfers
      destinationPhone?: string;
      // For bank transfers
      destinationBankName?: string;
      destinationAccountNumber?: string;
      destinationAccountName?: string;
      // Common fields
      recipientName?: string;
      amount: number;
      reason: string;
      votingType?: VotingType;
      deadlineHours?: number;
    },
    @Request() req: any,
  ) {
    // Validate amount
    if (transferDto.amount <= 0) {
      throw new BadRequestException('Transfer amount must be positive');
    }

    // Get source chama balance to validate sufficient funds
    const balance = await this.ledgerService.getChamaBalance(sourceChamaId);
    if (balance < transferDto.amount) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${balance}, Requested: ${transferDto.amount}`,
      );
    }

    // Validate destination type and required fields
    const destinationType = transferDto.destinationType || 'chama';
    let proposalTitle = '';
    let recipientLabel = transferDto.recipientName || '';

    switch (destinationType) {
      case 'chama':
        if (!transferDto.destinationChamaId) {
          throw new BadRequestException('Destination chama ID is required');
        }
        recipientLabel =
          recipientLabel || transferDto.destinationChamaName || 'another chama';
        proposalTitle = `Transfer KES ${transferDto.amount.toLocaleString()} to ${recipientLabel}`;
        break;
      case 'user':
        if (!transferDto.destinationUserId) {
          throw new BadRequestException('Destination user ID is required');
        }
        recipientLabel =
          recipientLabel || transferDto.destinationUserName || 'user wallet';
        proposalTitle = `Transfer KES ${transferDto.amount.toLocaleString()} to ${recipientLabel}`;
        break;
      case 'mpesa':
        if (!transferDto.destinationPhone) {
          throw new BadRequestException('Destination phone number is required');
        }
        recipientLabel = recipientLabel || transferDto.destinationPhone;
        proposalTitle = `M-Pesa transfer of KES ${transferDto.amount.toLocaleString()} to ${recipientLabel}`;
        break;
      case 'bank':
        if (
          !transferDto.destinationBankName ||
          !transferDto.destinationAccountNumber
        ) {
          throw new BadRequestException(
            'Bank name and account number are required',
          );
        }
        recipientLabel =
          recipientLabel ||
          `${transferDto.destinationBankName} - ${transferDto.destinationAccountNumber}`;
        proposalTitle = `Bank transfer of KES ${transferDto.amount.toLocaleString()} to ${recipientLabel}`;
        break;
      default:
        throw new BadRequestException(
          `Invalid destination type: ${destinationType}`,
        );
    }

    // Create a proposal for the transfer - requires majority vote
    const proposal = await this.governanceService.createProposal({
      chamaId: sourceChamaId,
      createdBy: req.user.id,
      proposalType: ProposalType.TRANSFER_FUNDS,
      title: proposalTitle,
      description: transferDto.reason,
      metadata: {
        destinationType,
        // Chama destination
        destinationChamaId: transferDto.destinationChamaId,
        destinationChamaName: transferDto.destinationChamaName,
        // User destination
        destinationUserId: transferDto.destinationUserId,
        destinationUserName: transferDto.destinationUserName,
        // M-Pesa destination
        destinationPhone: transferDto.destinationPhone,
        // Bank destination
        destinationBankName: transferDto.destinationBankName,
        destinationAccountNumber: transferDto.destinationAccountNumber,
        destinationAccountName: transferDto.destinationAccountName,
        // Common
        recipientName: recipientLabel,
        amount: transferDto.amount,
        reason: transferDto.reason,
      },
      votingType: transferDto.votingType || VotingType.SIMPLE_MAJORITY,
      requiredPercentage: 50.01, // Simple majority
      deadlineHours: transferDto.deadlineHours || 72, // 3 days default
    });

    return {
      success: true,
      message:
        'Transfer proposal created. Members must vote to approve this transfer.',
      proposal: {
        id: proposal.id,
        title: proposal.title,
        status: proposal.status,
        votingDeadline: proposal.voting_deadline,
        requiredPercentage: proposal.required_percentage,
      },
      transferDetails: {
        sourceChamaId,
        destinationType,
        recipientName: recipientLabel,
        amount: transferDto.amount,
        reason: transferDto.reason,
      },
    };
  }

  /**
   * Get chama deposit history
   * GET /api/ledger/chama/:chamaId/deposits
   */
  @Get('chama/:chamaId/deposits')
  @UseGuards(JwtAuthGuard)
  async getChamaDeposits(@Param('chamaId') chamaId: string) {
    return await this.ledgerService.getChamaDeposits(chamaId);
  }

  /**
   * Get chama transfer history
   * GET /api/ledger/chama/:chamaId/transfers
   */
  @Get('chama/:chamaId/transfers')
  @UseGuards(JwtAuthGuard)
  async getChamaTransfers(@Param('chamaId') chamaId: string) {
    return await this.ledgerService.getChamaTransfers(chamaId);
  }

  /**
   * Get chama transaction history (all types: contributions, payouts, transfers, deposits)
   * GET /api/ledger/chama/:chamaId/transactions?limit=50&offset=0
   */
  @Get('chama/:chamaId/transactions')
  @UseGuards(JwtAuthGuard)
  async getChamaTransactions(
    @Param('chamaId') chamaId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return await this.ledgerService.getChamaTransactionHistory(
      chamaId,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }

  // ==========================================
  // REPORTING & AUDIT
  // ==========================================

  @Get('balance-check')
  async checkLedgerBalance() {
    return await this.ledgerService.checkLedgerBalance();
  }
}
