import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { randomUUID } from 'crypto';
import { Payment } from './entities/payment.entity';
import { PaymentProvider } from './interfaces/payment-provider.interface';
import { BookingsService } from '../bookings/bookings.service';
import { CrmQueueService } from '../crm/crm.queue.service';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    @Inject('PAYMENT_PROVIDER')
    private paymentProvider: PaymentProvider,
    private bookingsService: BookingsService,
    @InjectQueue('payments')
    private paymentQueue: Queue,
    private crmQueue: CrmQueueService,
    private walletService: WalletService,
  ) {}

  async initiatePayment(
    bookingId: string,
    userId: string,
    creditCop = 0,
  ): Promise<{ payment: Payment; clientSecret?: string }> {
    const booking = await this.bookingsService.findById(bookingId);

    if (booking.travelerId !== userId) {
      throw new BadRequestException('Not authorized to pay for this booking');
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw new BadRequestException('Booking cannot be paid');
    }

    if (creditCop < 0) {
      throw new BadRequestException('creditCop must be a non-negative amount');
    }
    if (creditCop > 0) {
      const balance = await this.walletService.getBalance(userId);
      if (balance + 0.001 /* fp tolerance */ < creditCop) {
        throw new BadRequestException('Insufficient wallet credit');
      }
    }

    const amountDue = Number(booking.totalCop) - creditCop;
    if (amountDue < 0) {
      throw new BadRequestException('Wallet credit exceeds the booking total');
    }

    // Check for existing pending payment
    const existing = await this.paymentRepo.findOne({
      where: { bookingId, status: 'pending' },
    });
    if (existing) {
      const intent = await this.paymentProvider.getPayment(existing.providerPaymentId!);
      return { payment: existing, clientSecret: intent.clientSecret };
    }

    // Fully covered by wallet credit: complete immediately without a provider.
    if (amountDue === 0) {
      const payment = this.paymentRepo.create({
        bookingId,
        userId,
        amount: 0,
        creditCop,
        currency: booking.currencyPaid,
        provider: 'manual',
        providerPaymentId: `credit-${randomUUID()}`,
        status: 'completed',
      });
      const saved = await this.paymentRepo.save(payment);
      await this.walletService.applyCredit(userId, creditCop, bookingId);
      await this.bookingsService.markPaid(bookingId);
      await this.crmQueue.triggerAutomations('payment_received', { userId });
      await this.paymentQueue.add('payment-completed', { paymentId: saved.id });
      return { payment: saved };
    }

    // Create payment intent with provider
    const intent = await this.paymentProvider.createPaymentIntent({
      amount: amountDue,
      currency: booking.currencyPaid,
      bookingId: booking.id,
      userId,
      description: `Booking ${booking.bookingReference}`,
    });

    const payment = this.paymentRepo.create({
      bookingId,
      userId,
      amount: amountDue,
      creditCop,
      currency: booking.currencyPaid,
      provider: this.paymentProvider.name as any,
      providerPaymentId: intent.id,
      status: 'pending',
    });

    const saved = await this.paymentRepo.save(payment);
    return { payment: saved, clientSecret: intent.clientSecret };
  }

  async confirmPayment(paymentId: string): Promise<Payment> {
    const payment = await this.findById(paymentId);
    
    const intent = await this.paymentProvider.confirmPayment(payment.providerPaymentId!);

    if (intent.status === 'succeeded') {
      if (Number(payment.creditCop) > 0) {
        await this.walletService.applyCredit(payment.userId, Number(payment.creditCop), payment.bookingId);
      }
      payment.status = 'completed';
      await this.paymentRepo.save(payment);
      await this.bookingsService.markPaid(payment.bookingId);

      // Fan out event-driven CRM automations (gracefully degrades if Redis is down).
      await this.crmQueue.triggerAutomations('payment_received', { userId: payment.userId });

      // Queue post-payment tasks (notifications, referral fulfillment, etc.)
      await this.paymentQueue.add('payment-completed', { paymentId: payment.id });
    } else if (intent.status === 'failed') {
      payment.status = 'failed';
      await this.paymentRepo.save(payment);
    }

    return payment;
  }

  async processRefund(paymentId: string, amount?: number, reason?: string): Promise<Payment> {
    const payment = await this.findById(paymentId);

    if (payment.status !== 'completed') {
      throw new BadRequestException('Payment must be completed to refund');
    }

    const refundAmount = amount || Number(payment.amount);

    // A fully credit-paid booking has no real money to refund at the provider;
    // ledger bookkeeping (credit restore / reward void) still applies below.
    if (Number(payment.amount) > 0) {
      await this.paymentProvider.refund(payment.providerPaymentId!, refundAmount);
    }

    payment.refundedAmount = refundAmount;
    payment.refundReason = reason || 'Customer requested refund';
    payment.refundedAt = new Date();
    payment.status = refundAmount >= Number(payment.amount) ? 'refunded' : 'partially_refunded';

    await this.bookingsService.updateStatus(payment.bookingId, 'refunded');

    if (payment.status === 'refunded') {
      // Voids any referral reward this booking generated and restores any
      // wallet credit that was used to pay for it.
      await this.walletService.handleBookingRefund(payment.bookingId);
    }

    return this.paymentRepo.save(payment);
  }

  async findById(id: string): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['booking'],
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async findByBooking(bookingId: string): Promise<Payment[]> {
    return this.paymentRepo.find({ where: { bookingId } });
  }

  async handleWebhook(payload: any, signature: string): Promise<void> {
    const { event, data } = await this.paymentProvider.handleWebhook(payload, signature);

    if (event === 'payment_intent.succeeded') {
      const payment = await this.paymentRepo.findOne({
        where: { providerPaymentId: data.id },
      });
      if (payment && payment.status === 'pending') {
        await this.confirmPayment(payment.id);
      }
    }
  }
}
