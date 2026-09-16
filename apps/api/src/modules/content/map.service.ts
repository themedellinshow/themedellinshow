import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Place } from './entities/place.entity';
import { Event } from './entities/event.entity';
import { Experience } from '../experiences/entities/experience.entity';

export interface MapBoundsDto {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  includePlaces?: boolean;
  includeEvents?: boolean;
  includeExperiences?: boolean;
  category?: string;
  lgbtqFriendly?: boolean;
}

export interface MapPin {
  id: string;
  type: 'place' | 'event' | 'experience';
  title: string;
  latitude: number;
  longitude: number;
  category?: string;
  neighborhood?: string;
  imageUrl?: string;
  lgbtqFriendly?: boolean;
  extra?: Record<string, any>;
}

@Injectable()
export class MapService {
  constructor(
    @InjectRepository(Place)
    private placeRepo: Repository<Place>,
    @InjectRepository(Event)
    private eventRepo: Repository<Event>,
    @InjectRepository(Experience)
    private experienceRepo: Repository<Experience>,
  ) {}

  async pinsInBounds(dto: MapBoundsDto, lang: 'es' | 'en' = 'es'): Promise<MapPin[]> {
    const pins: MapPin[] = [];

    const inBox = (latCol: string, lngCol: string, alias: string) =>
      `${alias}.${latCol} BETWEEN :minLat AND :maxLat AND ${alias}.${lngCol} BETWEEN :minLng AND :maxLng`;

    const boxParams = {
      minLat: dto.minLat,
      maxLat: dto.maxLat,
      minLng: dto.minLng,
      maxLng: dto.maxLng,
    };

    if (dto.includePlaces !== false) {
      const qb = this.placeRepo
        .createQueryBuilder('p')
        .where('p.isActive = true')
        .andWhere(inBox('latitude', 'longitude', 'p'))
        .setParameters(boxParams);
      if (dto.category) qb.andWhere('p.category = :category', { category: dto.category });
      if (dto.lgbtqFriendly) qb.andWhere('p.lgbtqFriendly = true');
      const places = await qb.take(200).getMany();

      pins.push(
        ...places.map<MapPin>((p) => ({
          id: p.id,
          type: 'place',
          title: lang === 'es' ? p.nameEs : p.nameEn,
          latitude: Number(p.latitude),
          longitude: Number(p.longitude),
          category: p.category,
          neighborhood: p.neighborhood,
          imageUrl: p.imageUrls?.[0],
          lgbtqFriendly: p.lgbtqFriendly,
          extra: { priceRange: p.priceRange, averageRating: p.averageRating },
        })),
      );
    }

    if (dto.includeEvents !== false) {
      const qb = this.eventRepo
        .createQueryBuilder('e')
        .where('e.status = :status', { status: 'published' })
        .andWhere('e.startsAt >= :now', { now: new Date() })
        .andWhere('e.latitude IS NOT NULL')
        .andWhere(inBox('latitude', 'longitude', 'e'))
        .setParameters(boxParams);
      if (dto.lgbtqFriendly) qb.andWhere('e.lgbtqFriendly = true');
      const events = await qb.take(200).getMany();

      pins.push(
        ...events.map<MapPin>((e) => ({
          id: e.id,
          type: 'event',
          title: lang === 'es' ? e.titleEs : e.titleEn,
          latitude: Number(e.latitude),
          longitude: Number(e.longitude),
          category: e.category,
          neighborhood: e.neighborhood,
          imageUrl: e.coverImageUrl,
          lgbtqFriendly: e.lgbtqFriendly,
          extra: { startsAt: e.startsAt, endsAt: e.endsAt, minPriceCop: e.minPriceCop },
        })),
      );
    }

    if (dto.includeExperiences !== false) {
      const qb = this.experienceRepo
        .createQueryBuilder('x')
        .where('x.status = :status', { status: 'active' })
        .andWhere('x.latitude IS NOT NULL')
        .andWhere(inBox('latitude', 'longitude', 'x'))
        .setParameters(boxParams);
      if (dto.category) qb.andWhere('x.category = :category', { category: dto.category });
      if (dto.lgbtqFriendly) qb.andWhere('x.lgbtqFriendly = true');
      const experiences = await qb.take(200).getMany();

      pins.push(
        ...experiences.map<MapPin>((x) => ({
          id: x.id,
          type: 'experience',
          title: lang === 'es' ? x.titleEs : x.titleEn,
          latitude: Number(x.latitude),
          longitude: Number(x.longitude),
          category: x.category,
          neighborhood: x.neighborhood,
          imageUrl: x.imageUrls?.[0],
          lgbtqFriendly: x.lgbtqFriendly,
          extra: { priceCop: x.priceCop, averageRating: x.averageRating },
        })),
      );
    }

    return pins;
  }
}
