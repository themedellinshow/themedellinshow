import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Experience, ExperienceStatus } from './entities/experience.entity';
import { CreateExperienceDto } from './dto/create-experience.dto';
import { QueryExperiencesDto } from './dto/query-experiences.dto';

@Injectable()
export class ExperiencesService {
  constructor(
    @InjectRepository(Experience)
    private expRepo: Repository<Experience>,
  ) {}

  async create(hostId: string, dto: CreateExperienceDto): Promise<Experience> {
    const experience = this.expRepo.create({
      ...dto,
      hostId,
      status: 'draft',
    });
    return this.expRepo.save(experience);
  }

  async findAll(query: QueryExperiencesDto) {
    const qb = this.expRepo
      .createQueryBuilder('exp')
      .where('exp.status = :status', { status: 'active' });

    if (query.category) {
      qb.andWhere('exp.category = :category', { category: query.category });
    }

    if (query.neighborhood) {
      qb.andWhere('exp.neighborhood ILIKE :neighborhood', {
        neighborhood: `%${query.neighborhood}%`,
      });
    }

    if (query.minPrice !== undefined) {
      qb.andWhere('exp.priceCop >= :minPrice', { minPrice: query.minPrice });
    }

    if (query.maxPrice !== undefined) {
      qb.andWhere('exp.priceCop <= :maxPrice', { maxPrice: query.maxPrice });
    }

    if (query.participants) {
      qb.andWhere('exp.maxParticipants >= :participants', {
        participants: query.participants,
      });
    }

    if (query.lgbtqFriendly) {
      qb.andWhere('exp.lgbtqFriendly = true');
    }

    if (query.featured) {
      qb.andWhere('exp.featured = true');
    }

    if (query.search) {
      const lang = query.lang || 'es';
      const titleCol = lang === 'es' ? 'titleEs' : lang === 'en' ? 'titleEn' : 'titlePt';
      const descCol = lang === 'es' ? 'descriptionEs' : lang === 'en' ? 'descriptionEn' : 'descriptionPt';
      qb.andWhere(`(exp.${titleCol} ILIKE :search OR exp.${descCol} ILIKE :search)`, {
        search: `%${query.search}%`,
      });
    }

    // Sorting
    const sortMap = {
      price: 'exp.priceCop',
      rating: 'exp.averageRating',
      created: 'exp.createdAt',
      popular: 'exp.totalBookings',
    };
    const sortCol = sortMap[query.sortBy || 'created'];
    qb.orderBy(sortCol, query.sortOrder?.toUpperCase() as 'ASC' | 'DESC' || 'DESC');

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 20;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<Experience> {
    const exp = await this.expRepo.findOne({
      where: { id },
      relations: ['host'],
    });
    if (!exp) {
      throw new NotFoundException('Experience not found');
    }
    return exp;
  }

  async findByHost(hostId: string): Promise<Experience[]> {
    return this.expRepo.find({ where: { hostId }, order: { createdAt: 'DESC' } });
  }

  async update(id: string, hostId: string, dto: Partial<CreateExperienceDto>): Promise<Experience> {
    const exp = await this.findById(id);
    if (exp.hostId !== hostId) {
      throw new ForbiddenException('Not authorized to update this experience');
    }
    Object.assign(exp, dto);
    return this.expRepo.save(exp);
  }

  async updateStatus(id: string, status: ExperienceStatus): Promise<Experience> {
    const exp = await this.findById(id);
    exp.status = status;
    return this.expRepo.save(exp);
  }

  async delete(id: string, hostId: string): Promise<void> {
    const exp = await this.findById(id);
    if (exp.hostId !== hostId) {
      throw new ForbiddenException('Not authorized to delete this experience');
    }
    await this.expRepo.remove(exp);
  }
}
