import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { firstValueFrom } from 'rxjs';
import { NewsArticle, NewsCategory, NewsStatus } from './entities/news-article.entity';

export interface IngestArticleDto {
  title: string;
  content: string;
  source: string;
  sourceUrl?: string;
  publishedAt: string;
  imageUrl?: string;
}

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(NewsArticle)
    private newsRepo: Repository<NewsArticle>,
    private httpService: HttpService,
    private config: ConfigService,
    @InjectQueue('news')
    private newsQueue: Queue,
  ) {}

  async ingest(dto: IngestArticleDto): Promise<NewsArticle> {
    const article = this.newsRepo.create({
      originalTitle: dto.title,
      originalContent: dto.content,
      source: dto.source,
      sourceUrl: dto.sourceUrl,
      publishedAt: new Date(dto.publishedAt),
      imageUrl: dto.imageUrl,
      status: 'pending',
    });

    const saved = await this.newsRepo.save(article);

    // Queue for AI classification
    await this.newsQueue.add('classify-article', { articleId: saved.id });

    return saved;
  }

  async classifyArticle(articleId: string): Promise<NewsArticle> {
    const article = await this.findById(articleId);
    
    const aiGatewayUrl = this.config.get('AI_GATEWAY_URL', 'http://localhost:3002');
    
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${aiGatewayUrl}/ai/v1/news/classify`, {
          title: article.originalTitle,
          content: article.originalContent,
          source: article.source,
          publishedAt: article.publishedAt.toISOString(),
        }),
      );

      const result = response.data;
      
      article.category = result.category;
      article.confidence = result.confidence;
      article.summaryEs = result.summaryEs;
      article.summaryEn = result.summaryEn;
      article.tags = result.tags;
      article.classificationReason = result.reason;

      // Auto-approve high confidence relevant articles
      if (
        ['HIGHLY_RELEVANT', 'RELEVANT'].includes(result.category) &&
        result.confidence >= 0.8
      ) {
        article.status = 'approved';
      } else if (result.category === 'FLAGGED' || result.category === 'IRRELEVANT') {
        article.status = 'rejected';
      }

      return this.newsRepo.save(article);
    } catch (error) {
      // If AI classification fails, leave as pending for manual review
      return article;
    }
  }

  async findAll(query: {
    category?: NewsCategory;
    status?: NewsStatus;
    featured?: boolean;
    lang?: 'es' | 'en';
    page?: number;
    limit?: number;
  }) {
    const qb = this.newsRepo.createQueryBuilder('news');

    if (query.status) {
      qb.where('news.status = :status', { status: query.status });
    } else {
      qb.where('news.status IN (:...statuses)', { statuses: ['approved', 'published'] });
    }

    if (query.category) {
      qb.andWhere('news.category = :category', { category: query.category });
    }

    if (query.featured) {
      qb.andWhere('news.featured = true');
    }

    qb.orderBy('news.publishedAt', 'DESC');

    const page = query.page || 1;
    const limit = query.limit || 20;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<NewsArticle> {
    const article = await this.newsRepo.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
  }

  async updateStatus(id: string, status: NewsStatus): Promise<NewsArticle> {
    const article = await this.findById(id);
    article.status = status;
    return this.newsRepo.save(article);
  }

  async setFeatured(id: string, featured: boolean): Promise<NewsArticle> {
    const article = await this.findById(id);
    article.featured = featured;
    return this.newsRepo.save(article);
  }
}
