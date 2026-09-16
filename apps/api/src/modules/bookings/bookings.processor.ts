import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';

@Processor('bookings')
export class BookingsProcessor {
  private readonly logger = new Logger(BookingsProcessor.name);

  @Process('new-booking')
  async handleNewBooking(job: Job<{ bookingId: string; hostId: string }>) {
    this.logger.log(`Processing new booking notification: ${job.data.bookingId}`);
    // TODO: Send notification to host (WhatsApp, email, push)
    // This will be implemented in Phase 4 (notifications)
  }

  @Process('process-refund')
  async handleRefund(job: Job<{ bookingId: string }>) {
    this.logger.log(`Processing refund for booking: ${job.data.bookingId}`);
    // TODO: Process refund through payment provider
  }

  @Process('booking-reminder')
  async handleReminder(job: Job<{ bookingId: string }>) {
    this.logger.log(`Sending booking reminder: ${job.data.bookingId}`);
    // TODO: Send reminder notification to traveler
  }
}
