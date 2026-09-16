import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConciergeService } from './concierge.service';
import { ConciergeSessionService } from './concierge-session.service';
import { ConciergeController } from './concierge.controller';

@Module({
  imports: [HttpModule],
  controllers: [ConciergeController],
  providers: [ConciergeService, ConciergeSessionService],
  exports: [ConciergeService],
})
export class ConciergeModule {}
