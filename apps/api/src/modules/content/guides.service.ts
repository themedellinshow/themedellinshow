import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guide, GuideCategory, GuideStatus } from './entities/guide.entity';

export interface QueryGuidesDto {
  category?: GuideCategory;
  tag?: string;
  featured?: boolean;
  search?: string;
  lang?: 'es' | 'en' | 'pt';
  page?: number;
  limit?: number;
}

@Injectable()
export class GuidesService {
  constructor(
    @InjectRepository(Guide)
    private guideRepo: Repository<Guide>,
  ) {}

  async findAll(query: QueryGuidesDto) {
    const qb = this.guideRepo
      .createQueryBuilder('guide')
      .where('guide.status = :status', { status: 'published' });

    if (query.category) qb.andWhere('guide.category = :category', { category: query.category });
    if (query.featured) qb.andWhere('guide.featured = true');
    if (query.tag) qb.andWhere('guide.tags LIKE :tag', { tag: `%${query.tag}%` });

    if (query.search) {
      const lang = query.lang || 'es';
      const titleCol = lang === 'es' ? 'titleEs' : lang === 'en' ? 'titleEn' : 'titlePt';
      qb.andWhere(`guide.${titleCol} ILIKE :search`, { search: `%${query.search}%` });
    }

    qb.orderBy('guide.featured', 'DESC').addOrderBy('guide.publishedAt', 'DESC');

    const page = query.page || 1;
    const limit = query.limit || 20;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string): Promise<Guide> {
    const guide = await this.guideRepo.findOne({ where: { id } });
    if (!guide) throw new NotFoundException('Guide not found');
    return guide;
  }

  async findBySlug(slug: string): Promise<Guide> {
    const guide = await this.guideRepo.findOne({ where: { slug } });
    if (!guide) throw new NotFoundException('Guide not found');
    // Increment view count async (fire and forget)
    this.guideRepo.increment({ id: guide.id }, 'viewCount', 1).catch(() => undefined);
    return guide;
  }

  async create(data: Partial<Guide>): Promise<Guide> {
    if (data.slug) {
      const existing = await this.guideRepo.findOne({ where: { slug: data.slug } });
      if (existing) throw new ConflictException('Slug already in use');
    }
    return this.guideRepo.save(this.guideRepo.create(data));
  }

  async update(id: string, data: Partial<Guide>): Promise<Guide> {
    const guide = await this.findById(id);
    Object.assign(guide, data);
    return this.guideRepo.save(guide);
  }

  async publish(id: string): Promise<Guide> {
    const guide = await this.findById(id);
    guide.status = 'published';
    guide.publishedAt = new Date();
    return this.guideRepo.save(guide);
  }

  async updateStatus(id: string, status: GuideStatus): Promise<Guide> {
    const guide = await this.findById(id);
    guide.status = status;
    return this.guideRepo.save(guide);
  }
}
