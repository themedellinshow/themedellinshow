import { Module } from '@nestjs/common';
import { NewsFilterService } from './news-filter.service';
import { NewsFilterController } from './news-filter.controller';

@Module({
  controllers: [NewsFilterController],
  providers: [NewsFilterService],
  exports: [NewsFilterService],
})
export class NewsFilterModule {}
