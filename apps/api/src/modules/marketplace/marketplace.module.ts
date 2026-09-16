import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanionProfile } from './entities/companion-profile.entity';
import { HostProfile } from './entities/host-profile.entity';
import { CompanionsService } from './companions.service';
import { HostsService } from './hosts.service';
import { CompanionsController } from './companions.controller';
import { HostsController } from './hosts.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompanionProfile, HostProfile]),
    UsersModule,
  ],
  controllers: [CompanionsController, HostsController],
  providers: [CompanionsService, HostsService],
  exports: [CompanionsService, HostsService],
})
export class MarketplaceModule {}
