/* eslint-disable @typescript-eslint/require-await */
import { Controller, Post, Body, Logger } from '@nestjs/common';
import { MpesaService } from './mpesa.service';

@Controller('mpesa')
export class MpesaController {
  private readonly logger = new Logger(MpesaController.name);

  constructor(private readonly mpesa: MpesaService) {}

  /**
   * M-Pesa STK Push callback endpoint
   * POST /api/mpesa/callback
   * Called by Safaricom after user completes payment
   */
  @Post('callback')
  async handleCallback(@Body() payload: any) {
    this.logger.log('M-Pesa callback received', JSON.stringify(payload));

    try {
      await this.mpesa.handleCallback(payload);
      return { ResultCode: 0, ResultDesc: 'Success' };
    } catch (error) {
      this.logger.error('Callback processing failed', error);
      return { ResultCode: 1, ResultDesc: 'Failed to process callback' };
    }
  }

  /**
   * M-Pesa B2C result callback
   * POST /api/mpesa/b2c/result
   * Called by Safaricom after B2C payment completes
   */
  @Post('b2c/result')
  async handleB2CResult(@Body() payload: any) {
    this.logger.log('B2C result received', JSON.stringify(payload));

    try {
      // TODO: Process B2C result (withdrawal completion)
      return { ResultCode: 0, ResultDesc: 'Success' };
    } catch (error) {
      this.logger.error('B2C result processing failed', error);
      return { ResultCode: 1, ResultDesc: 'Failed to process result' };
    }
  }

  /**
   * M-Pesa B2C timeout callback
   * POST /api/mpesa/b2c/timeout
   * Called by Safaricom if B2C times out
   */
  @Post('b2c/timeout')
  async handleB2CTimeout(@Body() payload: any) {
    this.logger.log('B2C timeout received', JSON.stringify(payload));

    try {
      // TODO: Handle B2C timeout
      return { ResultCode: 0, ResultDesc: 'Success' };
    } catch (error) {
      this.logger.error('B2C timeout processing failed', error);
      return { ResultCode: 1, ResultDesc: 'Failed to process timeout' };
    }
  }
}
