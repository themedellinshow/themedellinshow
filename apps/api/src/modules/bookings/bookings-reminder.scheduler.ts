import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Booking } from './entities/booking.entity';

@Injectable()
export class BookingsReminderScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private static readonly REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

  private readonly logger = new Logger(BookingsReminderScheduler.name);
  private timer: NodeJS.Timeout | undefined;
  private remindedAt = new Map<string, number>();

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectQueue('bookings')
    private readonly bookingQueue: Queue,
  ) {}

  onApplicationBootstrap() {
    const minutes = Number(process.env.BOOKING_REMINDER_INTERVAL_MINUTES ?? 30);
    if (!Number.isFinite(minutes) || minutes <= 0) return;

    const run = () => {
      this.scanForReminders().catch((error) =>
        this.logger.error(`Booking reminder scan failed: ${error}`),
      );
    };

    this.timer = setInterval(run, minutes * 60 * 1000);
    run();
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.remindedAt.clear();
  }

  /**
   * Enqueues a "booking-reminder" job for every confirmed/paid booking
   * scheduled for tomorrow. A per-process in-memory guard prevents the same
   * booking from being reminded more than once within 24h.
   */
  async scanForReminders(): Promise<number> {
    const now = new Date();
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const nextDayStart = new Date(
      tomorrowStart.getFullYear(),
      tomorrowStart.getMonth(),
      tomorrowStart.getDate() + 1,
    );

    const bookings = await this.bookingRepo.find({
      where: {
        status: In(['confirmed', 'paid']),
        bookingDate: Between(tomorrowStart, nextDayStart),
      },
    });

    let enqueued = 0;
    for (const booking of bookings) {
      const last = this.remindedAt.get(booking.id) ?? 0;
      if (Date.now() - last < BookingsReminderScheduler.REMINDER_WINDOW_MS) continue;

      await this.bookingQueue.add('booking-reminder', { bookingId: booking.id });
      this.remindedAt.set(booking.id, Date.now());
      enqueued += 1;
    }

    if (enqueued) {
      this.logger.log(`Enqueued ${enqueued} booking reminder(s) for tomorrow`);
    }
    return enqueued;
  }
}