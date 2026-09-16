import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { Event, EventCategory, EventStatus } from './entities/event.entity';

export interface QueryEventsDto {
  category?: EventCategory;
  neighborhood?: string;
  from?: string; // ISO date
  to?: string;
  lgbtqFriendly?: boolean;
  featured?: boolean;
  search?: string;
  lang?: 'es' | 'en' | 'pt';
  page?: number;
  limit?: number;
}

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventRepo: Repository<Event>,
  ) {}

  async findAll(query: QueryEventsDto) {
    const qb = this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.place', 'place')
      .where('event.status = :status', { status: 'published' });

    if (query.category) {
      qb.andWhere('event.category = :category', { category: query.category });
    }

    if (query.neighborhood) {
      qb.andWhere('event.neighborhood ILIKE :neighborhood', {
        neighborhood: `%${query.neighborhood}%`,
      });
    }

    if (query.from) {
      qb.andWhere('event.startsAt >= :from', { from: new Date(query.from) });
    } else {
      qb.andWhere('event.startsAt >= :now', { now: new Date() });
    }

    if (query.to) {
      qb.andWhere('event.startsAt <= :to', { to: new Date(query.to) });
    }

    if (query.lgbtqFriendly) qb.andWhere('event.lgbtqFriendly = true');
    if (query.featured) qb.andWhere('event.featured = true');

    if (query.search) {
      const lang = query.lang || 'es';
      const titleCol = lang === 'es' ? 'titleEs' : lang === 'en' ? 'titleEn' : 'titlePt';
      qb.andWhere(`event.${titleCol} ILIKE :search`, { search: `%${query.search}%` });
    }

    qb.orderBy('event.featured', 'DESC').addOrderBy('event.startsAt', 'ASC');

    const page = query.page || 1;
    const limit = query.limit || 20;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findUpcoming(days = 7): Promise<Event[]> {
    const now = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);

    return this.eventRepo.find({
      where: {
        status: 'published',
        startsAt: Between(now, end),
      },
      order: { startsAt: 'ASC' },
      take: 50,
    });
  }

  async findById(id: string): Promise<Event> {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['place'],
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async create(data: Partial<Event>): Promise<Event> {
    return this.eventRepo.save(this.eventRepo.create(data));
  }

  async update(id: string, data: Partial<Event>): Promise<Event> {
    const event = await this.findById(id);
    Object.assign(event, data);
    return this.eventRepo.save(event);
  }

  async updateStatus(id: string, status: EventStatus): Promise<Event> {
    const event = await this.findById(id);
    event.status = status;
    return this.eventRepo.save(event);
  }

  /**
   * Batch task to move past events to 'past' status.
   * Intended for a scheduled job.
   */
  async archivePastEvents(): Promise<number> {
    const result = await this.eventRepo
      .createQueryBuilder()
      .update(Event)
      .set({ status: 'past' })
      .where('endsAt < :now AND status = :status', {
        now: new Date(),
        status: 'published',
      })
      .execute();
    return result.affected || 0;
  }
}
