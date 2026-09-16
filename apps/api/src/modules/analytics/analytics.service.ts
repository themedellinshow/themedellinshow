import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { Review } from '../reviews/entities/review.entity';
import { Experience } from '../experiences/entities/experience.entity';
import { User } from '../users/entities/user.entity';

export interface AnalyticsRangeDto {
  from?: string;
  to?: string;
  groupBy?: 'day' | 'week' | 'month';
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepo: Repository<Booking>,
    @InjectRepository(Review)
    private reviewRepo: Repository<Review>,
    @InjectRepository(Experience)
    private experienceRepo: Repository<Experience>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  private parseRange(dto: AnalyticsRangeDto) {
    const from = dto.from ? new Date(dto.from) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const to = dto.to ? new Date(dto.to) : new Date();
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      throw new BadRequestException('Invalid from/to range');
    }
    return { from, to };
  }

  private trunc(groupBy: 'day' | 'week' | 'month', col: string) {
    switch (groupBy) {
      case 'week':
        return `date_trunc('week', ${col})`;
      case 'month':
        return `date_trunc('month', ${col})`;
      default:
        return `date_trunc('day', ${col})`;
    }
  }

  /** Aggregate KPIs for a date window. */
  async kpis(dto: AnalyticsRangeDto) {
    const { from, to } = this.parseRange(dto);

    const bookingAgg =
      (await this.bookingRepo
        .createQueryBuilder('b')
        .select('COUNT(*)', 'bookings')
        .addSelect('COALESCE(SUM(b.totalCop),0)', 'gmv')
        .addSelect(`COALESCE(SUM(b.serviceFee),0)`, 'fees')
        .addSelect(
          `COUNT(*) FILTER (WHERE b.status = 'confirmed' OR b.status = 'paid' OR b.status = 'completed')`,
          'confirmed',
        )
        .addSelect(`COUNT(*) FILTER (WHERE b.status = 'cancelled')`, 'cancelled')
        .where('b.createdAt BETWEEN :from AND :to', { from, to })
        .getRawOne()) as
        | { bookings: string; gmv: string; fees: string; confirmed: string; cancelled: string }
        | undefined;

    const stats = {
      bookings: 0,
      confirmed: 0,
      cancelled: 0,
      gmvCop: 0,
      serviceFeesCop: 0,
      ...(bookingAgg
        ? {
            bookings: parseInt(bookingAgg.bookings, 10) || 0,
            confirmed: parseInt(bookingAgg.confirmed, 10) || 0,
            cancelled: parseInt(bookingAgg.cancelled, 10) || 0,
            gmvCop: parseFloat(bookingAgg.gmv) || 0,
            serviceFeesCop: parseFloat(bookingAgg.fees) || 0,
          }
        : {}),
    };

    const ratingAgg =
      (await this.reviewRepo
        .createQueryBuilder('r')
        .select('COALESCE(AVG(r.rating),0)', 'avgRating')
        .addSelect('COUNT(*)', 'reviews')
        .where('r.createdAt BETWEEN :from AND :to', { from, to })
        .getRawOne()) as { avgRating: string; reviews: string } | undefined;

    const reviewStats = {
      avgRating: 0,
      reviews: 0,
      ...(ratingAgg
        ? {
            avgRating: +(parseFloat(ratingAgg.avgRating) || 0).toFixed(2),
            reviews: parseInt(ratingAgg.reviews, 10) || 0,
          }
        : {}),
    };

    const experienceCount = await this.experienceRepo.count({ where: { status: 'active' } });
    const userCount = await this.userRepo.count();
    const bookingTotal = await this.bookingRepo.count();

    return {
      range: { from, to },
      bookings: stats.bookings,
      confirmed: stats.confirmed,
      cancelled: stats.cancelled,
      conversionRate:
        stats.bookings > 0 ? +((stats.confirmed / stats.bookings) * 100).toFixed(2) : 0,
      gmvCop: stats.gmvCop,
      serviceFeesCop: stats.serviceFeesCop,
      avgRating: reviewStats.avgRating,
      reviews: reviewStats.reviews,
      activeExperiences: experienceCount,
      totalUsers: userCount,
      totalBookingsAllTime: bookingTotal,
    };
  }

  /** Revenue + bookings series, grouped by day/week/month. */
  async revenueSeries(dto: AnalyticsRangeDto) {
    const { from, to } = this.parseRange(dto);
    const groupBy = dto.groupBy || 'day';
    const bucket = this.trunc(groupBy, 'b.createdAt');

    const rows = await this.bookingRepo
      .createQueryBuilder('b')
      .select(bucket, 'bucket')
      .addSelect('COUNT(*)', 'bookings')
      .addSelect('COALESCE(SUM(b.totalCop),0)', 'gmv')
      .addSelect('COALESCE(SUM(b.serviceFee),0)', 'fees')
      .where('b.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere("b.status NOT IN ('cancelled','refunded')")
      .groupBy(bucket)
      .orderBy('bucket', 'ASC')
      .getRawMany<{ bucket: Date; bookings: string; gmv: string; fees: string }>();

    return rows.map((r) => ({
      bucket: new Date(r.bucket),
      bookings: parseInt(r.bookings, 10),
      gmvCop: parseFloat(r.gmv),
      serviceFeesCop: parseFloat(r.fees),
    }));
  }

  /** Top experiences by confirmed bookings + revenue. */
  async topExperiences(dto: AnalyticsRangeDto & { limit?: number }) {
    const { from, to } = this.parseRange(dto);
    const limit = Math.min(dto.limit || 10, 50);

    const rows = await this.bookingRepo
      .createQueryBuilder('b')
      .select('b.experienceId', 'experienceId')
      .addSelect('COUNT(*)', 'bookings')
      .addSelect('COALESCE(SUM(b.totalCop),0)', 'gmv')
      .where('b.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere("b.status NOT IN ('cancelled','refunded')")
      .groupBy('b.experienceId')
      .orderBy('gmv', 'DESC')
      .limit(limit)
      .getRawMany<{ experienceId: string; bookings: string; gmv: string }>();

    const votes: Record<string, { avg: number; count: number }> = {};
    const ratings = await this.reviewRepo
      .createQueryBuilder('r')
      .select('r.experienceId', 'experienceId')
      .addSelect('AVG(r.rating)', 'avgRating')
      .addSelect('COUNT(*)', 'reviews')
      .where('r.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('r.experienceId')
      .getRawMany<{ experienceId: string; avgRating: string; reviews: string }>();
    ratings.forEach((r) => (votes[r.experienceId] = { avg: +r.avgRating, count: +r.reviews }));

    const items = await Promise.all(
      rows.map(async (r) => {
        const exp = await this.experienceRepo.findOne({ where: { id: r.experienceId } });
        const rate = votes[r.experienceId];
        return {
          experienceId: r.experienceId,
          titleEs: exp?.titleEs,
          titleEn: exp?.titleEn,
          bookings: parseInt(r.bookings, 10),
          gmvCop: parseFloat(r.gmv),
          avgRating: rate ? +rate.avg.toFixed(2) : null,
          reviewCount: rate ? rate.count : 0,
        };
      }),
    );

    return items;
  }

  /** Per-neighborhood aggregation for the map / guides. */
  async neighborhoodBreakdown(dto: AnalyticsRangeDto) {
    const { from, to } = this.parseRange(dto);

    const bookings = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.experience', 'x')
      .select('x.neighborhood', 'neighborhood')
      .addSelect('COUNT(*)', 'bookings')
      .addSelect('COALESCE(SUM(b.totalCop),0)', 'gmv')
      .where('b.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere('x.neighborhood IS NOT NULL')
      .groupBy('x.neighborhood')
      .orderBy('bookings', 'DESC')
      .limit(25)
      .getRawMany<{ neighborhood: string; bookings: string; gmv: string }>();

    return bookings.map((r) => ({
      neighborhood: r.neighborhood,
      bookings: parseInt(r.bookings, 10),
      gmvCop: parseFloat(r.gmv),
    }));
  }
}