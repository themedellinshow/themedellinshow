import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Place, PlaceCategory } from './entities/place.entity';

export interface QueryPlacesDto {
  category?: PlaceCategory;
  neighborhood?: string;
  lgbtqFriendly?: boolean;
  featured?: boolean;
  search?: string;
  lang?: 'es' | 'en' | 'pt';
  page?: number;
  limit?: number;
}

@Injectable()
export class PlacesService {
  constructor(
    @InjectRepository(Place)
    private placeRepo: Repository<Place>,
  ) {}

  async findAll(query: QueryPlacesDto) {
    const qb = this.placeRepo
      .createQueryBuilder('place')
      .where('place.isActive = true');

    if (query.category) {
      qb.andWhere('place.category = :category', { category: query.category });
    }

    if (query.neighborhood) {
      qb.andWhere('place.neighborhood ILIKE :neighborhood', {
        neighborhood: `%${query.neighborhood}%`,
      });
    }

    if (query.lgbtqFriendly) {
      qb.andWhere('place.lgbtqFriendly = true');
    }

    if (query.featured) {
      qb.andWhere('place.featured = true');
    }

    if (query.search) {
      const lang = query.lang || 'es';
      const nameCol = lang === 'es' ? 'nameEs' : 'nameEn';
      qb.andWhere(`place.${nameCol} ILIKE :search`, { search: `%${query.search}%` });
    }

    qb.orderBy('place.featured', 'DESC').addOrderBy('place.averageRating', 'DESC');

    const page = query.page || 1;
    const limit = query.limit || 20;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<Place> {
    const place = await this.placeRepo.findOne({ where: { id } });
    if (!place) {
      throw new NotFoundException('Place not found');
    }
    return place;
  }

  async findNearby(lat: number, lng: number, radiusKm: number = 2): Promise<Place[]> {
    // Haversine formula approximation for nearby search
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

    return this.placeRepo
      .createQueryBuilder('place')
      .where('place.isActive = true')
      .andWhere('place.latitude BETWEEN :minLat AND :maxLat', {
        minLat: lat - latDelta,
        maxLat: lat + latDelta,
      })
      .andWhere('place.longitude BETWEEN :minLng AND :maxLng', {
        minLng: lng - lngDelta,
        maxLng: lng + lngDelta,
      })
      .getMany();
  }

  async create(data: Partial<Place>): Promise<Place> {
    const place = this.placeRepo.create(data);
    return this.placeRepo.save(place);
  }

  async update(id: string, data: Partial<Place>): Promise<Place> {
    const place = await this.findById(id);
    Object.assign(place, data);
    return this.placeRepo.save(place);
  }
}
