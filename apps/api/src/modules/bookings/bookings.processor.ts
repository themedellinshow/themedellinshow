import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';

@Processor('bookings')
export class BookingsProcessor {
  private readonly logger = new Logger(BookingsProcessor.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly notificationsService: NotificationsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Process('new-booking')
  async handleNewBooking(job: Job<{ bookingId: string; hostId: string }>) {
    const booking = await this.bookingRepo.findOne({
      where: { id: job.data.bookingId },
      relations: ['experience', 'host'],
    });
    if (!booking?.host) {
      this.logger.warn(
        `Booking ${job.data.bookingId} or its host not found; skipping host notification`,
      );
      return;
    }

    await this.notificationsService.notifyHostNewBooking(booking, booking.host);
    this.logger.log(`Queued host notification for booking ${job.data.bookingId}`);
  }

  @Process('process-refund')
  async handleRefund(job: Job<{ bookingId: string }>) {
    const payments = await this.paymentsService.findByBooking(job.data.bookingId);
    const payment = payments.find((p) => p.status === 'completed');
    if (!payment) {
      this.logger.warn(
        `No completed payment to refund for booking ${job.data.bookingId} (statuses: ${
          payments.map((p) => p.status).join(', ') || 'none'
        })`,
      );
      return;
    }

    try {
      const refunded = await this.paymentsService.processRefund(
        payment.id,
        undefined,
        'Reembolso automático por cancelación de la reserva',
      );
      this.logger.log(`Refunded payment ${payment.id}: ${refunded.status}`);
    } catch (error) {
      this.logger.error(`Refund failed for payment ${payment.id}: ${error}`);
    }
  }

  @Process('booking-reminder')
  async handleReminder(job: Job<{ bookingId: string }>) {
    const booking = await this.bookingRepo.findOne({
      where: { id: job.data.bookingId },
      relations: ['experience', 'traveler'],
    });
    if (!booking?.traveler) {
      this.logger.warn(
        `Booking ${job.data.bookingId} or its traveler not found; skipping reminder`,
      );
      return;
    }

    await this.notificationsService.notifyBookingReminder(booking, booking.traveler);
    this.logger.log(`Queued booking reminder for booking ${job.data.bookingId}`);
  }
}