import { Controller, Post, Body } from '@nestjs/common';
import { NewsFilterService, NewsClassificationRequest } from './news-filter.service';

@Controller({ path: 'news', version: '1' })
export class NewsFilterController {
  constructor(private newsFilterService: NewsFilterService) {}

  @Post('classify')
  async classifyArticle(@Body() request: NewsClassificationRequest) {
    return this.newsFilterService.classifyArticle(request);
  }
}
