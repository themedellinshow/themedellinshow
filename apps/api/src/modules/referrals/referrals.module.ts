import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Referral } from './entities/referral.entity';
import { ReferralRedemption } from './entities/referral-redemption.entity';
import { ReferralsService } from './referrals.service';
import { ReferralRiskService } from './referral-risk.service';
import { ReferralsController } from './referrals.controller';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Referral, ReferralRedemption]),
    WalletModule,
  ],
  controllers: [ReferralsController],
  providers: [ReferralsService, ReferralRiskService],
  exports: [ReferralsService],
})
export class ReferralsModule {}