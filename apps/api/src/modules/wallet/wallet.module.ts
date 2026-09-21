import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralCredit } from './entities/referral-credit.entity';
import { WalletUse } from './entities/wallet-use.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { WalletScheduler } from './wallet.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([ReferralCredit, WalletUse, Booking])],
  controllers: [WalletController],
  providers: [WalletService, WalletScheduler],
  exports: [WalletService],
})
export class WalletModule {}