/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  Logger,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { WalletService } from '../wallet/wallet.service';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface STKPushRequest {
  phoneNumber: string; // Format: 254712345678
  amount: number;
  accountReference: string; // Transaction reference
  transactionDesc: string;
}

export interface STKPushResponse {
  checkoutRequestId: string;
  merchantRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

export interface MPesaCallback {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: string | number;
        }>;
      };
    };
  };
}

@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,
  ) {}

  /**
   * Format phone number to M-Pesa format (254XXXXXXXXX)
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // If starts with 0, replace with 254
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    }

    // If starts with +254, remove the +
    if (cleaned.startsWith('+254')) {
      cleaned = cleaned.substring(1);
    }

    // If doesn't start with 254, add it
    if (!cleaned.startsWith('254')) {
      cleaned = '254' + cleaned;
    }

    return cleaned;
  }

  /**
   * Get OAuth access token from Safaricom
   * Cached for performance
   */
  private async getAccessToken(): Promise<string> {
    // Check if token is still valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const consumerKey = this.config.get<string>('MPESA_CONSUMER_KEY');
    const consumerSecret = this.config.get<string>('MPESA_CONSUMER_SECRET');
    const authUrl = this.config.get<string>('MPESA_AUTH_URL');

    if (!consumerKey || !consumerSecret || !authUrl) {
      throw new Error('M-Pesa credentials not configured');
    }

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
      'base64',
    );

    try {
      const response = await axios.get(authUrl, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      this.accessToken = response.data.access_token;
      // Token expires in 3599 seconds, refresh 5 minutes before
      this.tokenExpiry = new Date(Date.now() + 3300 * 1000);

      return this.accessToken!;
    } catch (error: any) {
      this.logger.error('Failed to get M-Pesa access token', error);
      throw new Error('M-Pesa authentication failed');
    }
  }

  /**
   * Initiate STK Push (Lipa Na M-Pesa Online)
   * Prompts user to enter M-Pesa PIN on their phone
   */
  async stkPush(request: STKPushRequest): Promise<STKPushResponse> {
    const token = await this.getAccessToken();

    const shortCode = this.config.get<string>('MPESA_SHORTCODE');
    const passkey = this.config.get<string>('MPESA_PASSKEY');
    const callbackUrl = this.config.get<string>('MPESA_CALLBACK_URL');
    const stkPushUrl = this.config.get<string>('MPESA_STK_PUSH_URL');

    if (!shortCode || !passkey || !callbackUrl || !stkPushUrl) {
      throw new Error('M-Pesa configuration incomplete');
    }

    // Generate timestamp: YYYYMMDDHHmmss
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14);

    // Generate password: Base64(Shortcode + Passkey + Timestamp)
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString(
      'base64',
    );

    // Format phone number
    const formattedPhone = this.formatPhoneNumber(request.phoneNumber);
    this.logger.log(
      `Initiating STK Push to ${formattedPhone} for amount ${request.amount}`,
    );

    const payload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(request.amount), // M-Pesa only accepts whole numbers
      PartyA: formattedPhone,
      PartyB: shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: request.accountReference,
      TransactionDesc: request.transactionDesc,
    };

    this.logger.debug('STK Push payload:', JSON.stringify(payload, null, 2));

    try {
      const response = await axios.post(stkPushUrl, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = response.data;
      this.logger.log(`STK Push successful: ${data.CheckoutRequestID}`);

      return {
        checkoutRequestId: data.CheckoutRequestID,
        merchantRequestId: data.MerchantRequestID,
        responseCode: data.ResponseCode,
        responseDescription: data.ResponseDescription,
        customerMessage: data.CustomerMessage,
      };
    } catch (error: any) {
      this.logger.error('STK Push failed', error.response?.data || error);
      throw new BadRequestException(
        error.response?.data?.errorMessage || 'STK Push failed',
      );
    }
  }

  /**
   * Query STK Push transaction status
   */
  async querySTKPush(checkoutRequestId: string): Promise<any> {
    const token = await this.getAccessToken();

    const shortCode = this.config.get<string>('MPESA_SHORTCODE');
    const passkey = this.config.get<string>('MPESA_PASSKEY');
    const queryUrl = this.config.get<string>('MPESA_STK_QUERY_URL');

    if (!shortCode || !passkey || !queryUrl) {
      throw new Error('M-Pesa configuration incomplete');
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14);
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString(
      'base64',
    );

    const payload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    try {
      const response = await axios.post(queryUrl, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error: any) {
      this.logger.error('STK Query failed', error.response?.data || error);
      throw new BadRequestException('Failed to query transaction status');
    }
  }

  /**
   * Handle M-Pesa callback
   * Called by Safaricom after user completes/cancels payment
   */
  async handleCallback(callback: MPesaCallback): Promise<void> {
    const stkCallback = callback.Body.stkCallback;
    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;

    this.logger.log(
      `M-Pesa callback received: ${checkoutRequestId}, Result: ${resultCode}`,
    );

    // Extract metadata
    let amount = 0;
    let phoneNumber = '';
    let mpesaReceiptNumber = '';
    let transactionDate = '';

    if (stkCallback.CallbackMetadata?.Item) {
      for (const item of stkCallback.CallbackMetadata.Item) {
        switch (item.Name) {
          case 'Amount':
            amount = Number(item.Value);
            break;
          case 'MpesaReceiptNumber':
            mpesaReceiptNumber = String(item.Value);
            break;
          case 'PhoneNumber':
            phoneNumber = String(item.Value);
            break;
          case 'TransactionDate':
            transactionDate = String(item.Value);
            break;
        }
      }
    }

    // Update callback record
    await this.db.query(
      `UPDATE mpesa_callbacks
       SET result_code = $1,
           result_desc = $2,
           mpesa_receipt_number = $3,
           callback_metadata = $4,
           status = CASE WHEN $1 = 0 THEN 'completed' ELSE 'failed' END,
           callback_received_at = NOW(),
           processed_at = NOW()
       WHERE checkout_request_id = $5`,
      [
        resultCode,
        resultDesc,
        mpesaReceiptNumber || null,
        JSON.stringify(stkCallback),
        checkoutRequestId,
      ],
    );

    // If successful (resultCode = 0), trigger ledger transaction completion
    if (resultCode === 0) {
      await this.completeDepositTransaction(
        checkoutRequestId,
        mpesaReceiptNumber,
      );
    }
  }

  /**
   * Complete deposit transaction in ledger after successful callback
   */
  private async completeDepositTransaction(
    checkoutRequestId: string,
    mpesaReceiptNumber: string,
  ): Promise<void> {
    // Get callback record
    const callbackResult = await this.db.query(
      'SELECT * FROM mpesa_callbacks WHERE checkout_request_id = $1',
      [checkoutRequestId],
    );

    if (callbackResult.rows.length === 0) {
      this.logger.error(`Callback record not found: ${checkoutRequestId}`);
      return;
    }

    const callback = callbackResult.rows[0];

    try {
      this.logger.log(
        `Completing M-Pesa deposit: User ${callback.user_id}, Amount ${callback.amount}, Receipt ${mpesaReceiptNumber}`,
      );

      // Complete the deposit through wallet service
      await this.walletService.completeDeposit(
        callback.user_id,
        Number(callback.amount),
        mpesaReceiptNumber,
        checkoutRequestId, // Use checkoutRequestId as externalReference for idempotency
      );

      this.logger.log(
        `Deposit completed successfully for user ${callback.user_id}`,
      );
    } catch (error) {
      this.logger.error('Failed to complete deposit in ledger:', error);
      throw error;
    }
  }

  /**
   * Initiate B2C payment (Business to Customer - Withdrawals)
   * Sends money from business to customer M-Pesa account
   */
  async b2cPayment(
    phoneNumber: string,
    amount: number,
    remarks: string,
  ): Promise<any> {
    const token = await this.getAccessToken();

    const shortCode = this.config.get<string>('MPESA_B2C_SHORTCODE');
    const initiatorName = this.config.get<string>('MPESA_INITIATOR_NAME');
    const securityCredential = this.config.get<string>(
      'MPESA_SECURITY_CREDENTIAL',
    );
    const b2cUrl = this.config.get<string>('MPESA_B2C_URL');
    const queueTimeoutUrl = this.config.get<string>('MPESA_B2C_TIMEOUT_URL');
    const resultUrl = this.config.get<string>('MPESA_B2C_RESULT_URL');

    if (!shortCode || !initiatorName || !securityCredential || !b2cUrl) {
      throw new BadRequestException(
        'Withdrawals are currently unavailable. M-Pesa B2C configuration required.',
      );
    }

    // Format phone number to 254XXXXXXXXX
    const formattedPhone = this.formatPhoneNumber(phoneNumber);

    const payload = {
      InitiatorName: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: 'BusinessPayment',
      Amount: Math.round(amount),
      PartyA: shortCode,
      PartyB: formattedPhone,
      Remarks: remarks,
      QueueTimeOutURL: queueTimeoutUrl,
      ResultURL: resultUrl,
      Occasion: 'Withdrawal',
    };

    try {
      const response = await axios.post(b2cUrl, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error: any) {
      this.logger.error('B2C payment failed', error.response?.data || error);
      throw new BadRequestException(
        error.response?.data?.errorMessage || 'B2C payment failed',
      );
    }
  }

  /**
   * Create pending callback record before initiating STK Push
   */
  async createCallbackRecord(
    userId: string,
    phoneNumber: string,
    amount: number,
    checkoutRequestId: string,
    merchantRequestId: string,
    transactionType: 'deposit' | 'withdrawal',
  ): Promise<string> {
    const callbackId = uuidv4();

    await this.db.query(
      `INSERT INTO mpesa_callbacks (
        id, checkout_request_id, merchant_request_id, user_id,
        phone_number, amount, status, transaction_type
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)`,
      [
        callbackId,
        checkoutRequestId,
        merchantRequestId,
        userId,
        phoneNumber,
        amount,
        transactionType,
      ],
    );

    return callbackId;
  }
}
