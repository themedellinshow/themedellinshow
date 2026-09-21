import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HostPayout } from './entities/host-payout.entity';
import { PayoutBatch } from './entities/payout-batch.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { PayoutsService } from './payouts.service';
import { PayoutBatchScheduler } from './payout-batch.scheduler';
import { PayoutsController } from './payouts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HostPayout, PayoutBatch, Booking])],
  controllers: [PayoutsController],
  providers: [PayoutsService, PayoutBatchScheduler],
  exports: [PayoutsService],
})
export class PayoutsModule {}