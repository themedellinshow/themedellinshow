import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PromptCacheModule } from './cache/prompt-cache.module';
import { NewsFilterModule } from './news-filter/news-filter.module';
import { ConciergeEngineModule } from './concierge-engine/concierge-engine.module';
import { ModerationModule } from './moderation/moderation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PromptCacheModule,
    NewsFilterModule,
    ConciergeEngineModule,
    ModerationModule,
  ],
})
export class AppModule {}
