import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Booking } from './entities/booking.entity';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { BookingsProcessor } from './bookings.processor';
import { BookingsReminderScheduler } from './bookings-reminder.scheduler';
import { ExperiencesModule } from '../experiences/experiences.module';
import { CrmModule } from '../crm/crm.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking]),
    BullModule.registerQueue({ name: 'bookings' }),
    ExperiencesModule,
    CrmModule,
    NotificationsModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsProcessor, BookingsReminderScheduler],
  exports: [BookingsService],
})
export class BookingsModule {}
