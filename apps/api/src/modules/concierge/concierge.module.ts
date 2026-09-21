import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConciergeService } from './concierge.service';
import { ConciergeSessionService } from './concierge-session.service';
import { ConciergeController } from './concierge.controller';
import { CrmModule } from '../crm/crm.module';

@Module({
  imports: [HttpModule, CrmModule],
  controllers: [ConciergeController],
  providers: [ConciergeService, ConciergeSessionService],
  exports: [ConciergeService],
})
export class ConciergeModule {}
