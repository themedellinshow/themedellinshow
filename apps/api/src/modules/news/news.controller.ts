import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NewsService, IngestArticleDto } from './news.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { NewsCategory, NewsStatus } from './entities/news-article.entity';

@Controller({ path: 'news', version: '1' })
export class NewsController {
  constructor(private newsService: NewsService) {}

  @Get()
  async findAll(
    @Query('category') category?: NewsCategory,
    @Query('featured') featured?: string,
    @Query('lang') lang?: 'es' | 'en',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.newsService.findAll({
      category,
      featured: featured === 'true',
      lang,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.newsService.findById(id);
  }

  // Admin endpoints
  @Post('ingest')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async ingest(@Body() dto: IngestArticleDto) {
    return this.newsService.ingest(dto);
  }

  @Get('admin/pending')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async findPending(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.newsService.findAll({
      status: 'pending',
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: NewsStatus,
  ) {
    return this.newsService.updateStatus(id, status);
  }

  @Patch(':id/featured')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async setFeatured(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('featured') featured: boolean,
  ) {
    return this.newsService.setFeatured(id, featured);
  }
}
