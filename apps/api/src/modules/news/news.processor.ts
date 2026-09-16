import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { NewsService } from './news.service';

@Processor('news')
export class NewsProcessor {
  private readonly logger = new Logger(NewsProcessor.name);

  constructor(private newsService: NewsService) {}

  @Process('classify-article')
  async handleClassifyArticle(job: Job<{ articleId: string }>) {
    this.logger.log(`Classifying article: ${job.data.articleId}`);
    await this.newsService.classifyArticle(job.data.articleId);
  }
}
