import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Payment } from './entities/payment.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsProcessor } from './payments.processor';
import { StripeProvider } from './providers/stripe.provider';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    BullModule.registerQueue({ name: 'payments' }),
    BookingsModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsProcessor,
    StripeProvider,
    {
      provide: 'PAYMENT_PROVIDER',
      useExisting: StripeProvider,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
