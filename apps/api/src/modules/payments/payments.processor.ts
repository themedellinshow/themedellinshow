import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';

@Processor('payments')
export class PaymentsProcessor {
  private readonly logger = new Logger(PaymentsProcessor.name);

  @Process('payment-completed')
  async handlePaymentCompleted(job: Job<{ paymentId: string }>) {
    this.logger.log(`Processing payment completed: ${job.data.paymentId}`);
    // TODO: Send confirmation to traveler
    // TODO: Notify host of confirmed booking
    // TODO: Update CRM
  }

  @Process('payout-host')
  async handleHostPayout(job: Job<{ hostId: string; amount: number }>) {
    this.logger.log(`Processing host payout: ${job.data.hostId}`);
    // TODO: Process payout to host bank account
  }
}
