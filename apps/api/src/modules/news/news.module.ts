import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { NewsArticle } from './entities/news-article.entity';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { NewsProcessor } from './news.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([NewsArticle]),
    HttpModule,
    BullModule.registerQueue({ name: 'news' }),
  ],
  controllers: [NewsController],
  providers: [NewsService, NewsProcessor],
  exports: [NewsService],
})
export class NewsModule {}
