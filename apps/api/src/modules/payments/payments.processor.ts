import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { ReferralsService } from '../referrals/referrals.service';

@Processor('payments')
export class PaymentsProcessor {
  private readonly logger = new Logger(PaymentsProcessor.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly referralsService: ReferralsService,
  ) {}

  @Process('payment-completed')
  async handlePaymentCompleted(job: Job<{ paymentId: string }>) {
    const payment = await this.paymentRepo.findOne({
      where: { id: job.data.paymentId },
      relations: ['booking'],
    });
    if (!payment) {
      this.logger.warn(`Payment ${job.data.paymentId} not found`);
      return;
    }

    // First paid booking of a referred user grants the referrer a pending
    // wallet credit (10% of the purchase, capped) once confirmed.
    if (payment.booking) {
      await this.referralsService.fulfillOnQualifyingBooking(
        payment.booking.travelerId,
        { id: payment.booking.id, totalCop: Number(payment.booking.totalCop) },
      );
    }
  }

  @Process('payout-host')
  async handleHostPayout(job: Job<{ hostId: string; amount: number }>) {
    this.logger.log(`Processing host payout: ${job.data.hostId}`);
    // Deprecated legacy job. Weekly host payouts are now handled by the
    // PayoutBatchScheduler (host_payouts ledger) — see PayoutsModule.
  }
}