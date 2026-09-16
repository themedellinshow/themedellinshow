import { Module, Global } from '@nestjs/common';
import { PromptCacheService } from './prompt-cache.service';

@Global()
@Module({
  providers: [PromptCacheService],
  exports: [PromptCacheService],
})
export class PromptCacheModule {}
