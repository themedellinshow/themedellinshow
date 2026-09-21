import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Booking, BookingStatus } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ExperiencesService } from '../experiences/experiences.service';
import { CrmQueueService } from '../crm/crm.queue.service';
import { PayoutsService } from '../payouts/payouts.service';
import { randomBytes } from 'crypto';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepo: Repository<Booking>,
    private expService: ExperiencesService,
    private crmQueue: CrmQueueService,
    private payoutsService: PayoutsService,
    @InjectQueue('bookings')
    private bookingQueue: Queue,
  ) {}

  async create(travelerId: string, dto: CreateBookingDto): Promise<Booking> {
    const experience = await this.expService.findById(dto.experienceId);

    if (experience.status !== 'active') {
      throw new BadRequestException('Experience is not available for booking');
    }

    if (dto.participants > experience.maxParticipants) {
      throw new BadRequestException(`Max participants is ${experience.maxParticipants}`);
    }

    if (dto.participants < experience.minParticipants) {
      throw new BadRequestException(`Min participants is ${experience.minParticipants}`);
    }

    const subtotal = Number(experience.priceCop) * dto.participants;
    const serviceFee = subtotal * 0.10; // 10% service fee
    const total = subtotal + serviceFee;

    const booking = this.bookingRepo.create({
      bookingReference: this.generateReference(),
      travelerId,
      experienceId: dto.experienceId,
      hostId: experience.hostId,
      bookingDate: dto.bookingDate,
      startTime: dto.startTime,
      participants: dto.participants,
      subtotalCop: subtotal,
      serviceFee,
      totalCop: total,
      currencyPaid: 'COP',
      specialRequests: dto.specialRequests,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      status: 'pending',
    });

    const saved = await this.bookingRepo.save(booking);

    // Queue notification to host
    await this.bookingQueue.add('new-booking', {
      bookingId: saved.id,
      hostId: experience.hostId,
    });

    // Track in CRM (async via queue)
    await this.trackBooking('created', saved);

    return saved;
  }

  async findById(id: string): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({
      where: { id },
      relations: ['experience', 'traveler', 'host'],
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  async findByReference(ref: string): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({
      where: { bookingReference: ref },
      relations: ['experience', 'traveler'],
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  async findByTraveler(travelerId: string): Promise<Booking[]> {
    return this.bookingRepo.find({
      where: { travelerId },
      relations: ['experience'],
      order: { bookingDate: 'DESC' },
    });
  }

  async findByHost(hostId: string): Promise<Booking[]> {
    return this.bookingRepo.find({
      where: { hostId },
      relations: ['experience', 'traveler'],
      order: { bookingDate: 'DESC' },
    });
  }

  async confirm(id: string, hostId: string): Promise<Booking> {
    const booking = await this.findById(id);
    if (booking.hostId !== hostId) {
      throw new ForbiddenException('Not authorized');
    }
    if (booking.status !== 'pending') {
      throw new BadRequestException('Booking cannot be confirmed');
    }
    booking.status = 'confirmed';
    booking.confirmedAt = new Date();
    const saved = await this.bookingRepo.save(booking);
    await this.trackBooking('confirmed', saved);
    return saved;
  }

  async markPaid(id: string): Promise<Booking> {
    const booking = await this.findById(id);
    booking.status = 'paid';
    booking.paidAt = new Date();
    const saved = await this.bookingRepo.save(booking);
    await this.trackBooking('paid', saved);
    return saved;
  }

  async complete(id: string): Promise<Booking> {
    const booking = await this.findById(id);
    if (booking.status !== 'paid') {
      throw new BadRequestException('Booking must be paid first');
    }
    booking.status = 'completed';
    booking.completedAt = new Date();
    
    // Update experience stats
    await this.expService.findById(booking.experienceId).then(async (exp) => {
      exp.totalBookings += 1;
    });

    const saved = await this.bookingRepo.save(booking);
    await this.trackBooking('completed', saved);

    // Open the host payout release window (held until completion + 72h).
    if (saved.hostId) {
      await this.payoutsService.openReleaseWindow(saved);
    }

    return saved;
  }

  async openDispute(
    id: string,
    userId: string,
    role: string,
    reason: string,
  ): Promise<Booking> {
    const booking = await this.findById(id);
    const authorized = booking.travelerId === userId || role === 'admin';
    if (!authorized) {
      throw new ForbiddenException('Not authorized');
    }
    if (booking.status !== 'paid' && booking.status !== 'completed') {
      throw new BadRequestException('Booking cannot be disputed in its current state');
    }
    if (booking.disputedAt && !booking.disputeResolvedAt) {
      throw new BadRequestException('Booking is already under dispute');
    }

    booking.disputedAt = new Date();
    booking.disputeResolvedAt = null;
    booking.disputeResolution = reason;
    return this.bookingRepo.save(booking);
  }

  /**
   * Resolves an open dispute. Refund-based resolutions enqueue the async
   * refund pipeline; the host payout remains held until the 72h window and
   * dispute state allow its release.
   */
  async resolveDispute(
    id: string,
    resolution: 'resolved_without_refund' | 'full_refund' | 'partial_refund',
    note?: string,
  ): Promise<Booking> {
    const booking = await this.findById(id);
    if (!booking.disputedAt || booking.disputeResolvedAt) {
      throw new BadRequestException('Booking has no open dispute');
    }

    booking.disputeResolvedAt = new Date();
    booking.disputeResolution = `${resolution}${note ? `: ${note}` : ''}`;
    const saved = await this.bookingRepo.save(booking);

    if (resolution !== 'resolved_without_refund' && booking.paidAt) {
      await this.bookingQueue.add('process-refund', { bookingId: booking.id });
    }

    return saved;
  }

  async cancel(id: string, userId: string, reason: string): Promise<Booking> {
    const booking = await this.findById(id);
    if (booking.travelerId !== userId && booking.hostId !== userId) {
      throw new ForbiddenException('Not authorized');
    }
    if (['completed', 'cancelled', 'refunded'].includes(booking.status)) {
      throw new BadRequestException('Booking cannot be cancelled');
    }
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason;

    const saved = await this.bookingRepo.save(booking);

    // A cancelled booking never pays the host.
    await this.payoutsService.voidForBooking(booking.id);

    // Queue refund after persistence so the async refund lands on the final status
    if (booking.paidAt) {
      await this.bookingQueue.add('process-refund', { bookingId: booking.id });
    }

    await this.trackBooking('cancelled', saved);
    return saved;
  }

  async updateStatus(id: string, status: BookingStatus): Promise<Booking> {
    const booking = await this.findById(id);
    booking.status = status;
    return this.bookingRepo.save(booking);
  }

  private generateReference(): string {
    const prefix = 'MDS';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  private trackBooking(
    type: 'created' | 'confirmed' | 'paid' | 'completed' | 'cancelled',
    booking: Booking,
  ): Promise<void> {
    return this.crmQueue.trackBooking({
      type,
      email: booking.contactEmail,
      bookingValueCop: Number(booking.totalCop),
      metadata: {
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        experienceId: booking.experienceId,
        status: booking.status,
      },
    });
  }
}
