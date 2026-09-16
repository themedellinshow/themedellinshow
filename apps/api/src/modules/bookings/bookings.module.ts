import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Booking } from './entities/booking.entity';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { BookingsProcessor } from './bookings.processor';
import { ExperiencesModule } from '../experiences/experiences.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking]),
    BullModule.registerQueue({ name: 'bookings' }),
    ExperiencesModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsProcessor],
  exports: [BookingsService],
})
export class BookingsModule {}
