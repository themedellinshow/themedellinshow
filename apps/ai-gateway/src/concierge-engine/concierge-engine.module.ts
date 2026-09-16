import { Module } from '@nestjs/common';
import { ConciergeEngineService } from './concierge-engine.service';
import { ConciergeEngineController } from './concierge-engine.controller';

@Module({
  controllers: [ConciergeEngineController],
  providers: [ConciergeEngineService],
  exports: [ConciergeEngineService],
})
export class ConciergeEngineModule {}
