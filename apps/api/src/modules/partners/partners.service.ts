import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Partner, PartnerStatus } from './entities/partner.entity';
import { PartnerAttribution } from './entities/partner-attribution.entity';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class PartnersService {
  constructor(
    @InjectRepository(Partner)
    private partnerRepo: Repository<Partner>,
    @InjectRepository(PartnerAttribution)
    private attributionRepo: Repository<PartnerAttribution>,
  ) {}

  async create(dto: CreatePartnerDto): Promise<Partner> {
    const [slugExists, codeExists] = await Promise.all([
      this.partnerRepo.findOne({ where: { slug: dto.slug } }),
      dto.attributionCode
        ? this.partnerRepo.findOne({ where: { attributionCode: dto.attributionCode } })
        : Promise.resolve(null),
    ]);

    if (slugExists) throw new ConflictException('Slug already in use');
    if (codeExists) throw new ConflictException('Attribution code already in use');

    const partner = this.partnerRepo.create({
      ...dto,
      attributionCode: dto.attributionCode || this.generateAttributionCode(dto.slug),
      status: 'pending',
    });
    return this.partnerRepo.save(partner);
  }

  async findAll(query: { status?: PartnerStatus; type?: string; page?: number; limit?: number }) {
    const qb = this.partnerRepo.createQueryBuilder('partner');
    if (query.status) qb.andWhere('partner.status = :status', { status: query.status });
    if (query.type) qb.andWhere('partner.partnerType = :type', { type: query.type });

    qb.orderBy('partner.tier', 'DESC').addOrderBy('partner.createdAt', 'DESC');

    const page = query.page || 1;
    const limit = query.limit || 25;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string): Promise<Partner> {
    const partner = await this.partnerRepo.findOne({ where: { id } });
    if (!partner) throw new NotFoundException('Partner not found');
    return partner;
  }

  async findByAttributionCode(code: string): Promise<Partner | null> {
    return this.partnerRepo.findOne({ where: { attributionCode: code } });
  }

  async findByOwnerUser(userId: string): Promise<Partner | null> {
    return this.partnerRepo.findOne({ where: { ownerUserId: userId } });
  }

  async update(id: string, data: Partial<Partner>): Promise<Partner> {
    const partner = await this.findById(id);
    Object.assign(partner, data);
    return this.partnerRepo.save(partner);
  }

  async updateStatus(id: string, status: PartnerStatus): Promise<Partner> {
    const partner = await this.findById(id);
    partner.status = status;
    return this.partnerRepo.save(partner);
  }

  /**
   * Record attribution when a booking is created via a partner's link/code.
   * Called from BookingsService (async via queue) or on webhook.
   */
  async recordAttribution(
    partnerId: string,
    bookingId: string,
    bookingValueCop: number,
  ): Promise<PartnerAttribution> {
    const partner = await this.findById(partnerId);
    const commissionPercent = Number(partner.commissionPercent);
    const commissionCop = +(bookingValueCop * (commissionPercent / 100)).toFixed(2);

    const attribution = this.attributionRepo.create({
      partnerId,
      bookingId,
      bookingValueCop,
      commissionPercent,
      commissionCop,
      payoutStatus: 'accrued',
    });

    const saved = await this.attributionRepo.save(attribution);

    partner.totalBookings += 1;
    partner.totalRevenueCop = Number(partner.totalRevenueCop) + bookingValueCop;
    partner.totalCommissionCop = Number(partner.totalCommissionCop) + commissionCop;
    await this.partnerRepo.save(partner);

    return saved;
  }

  async listAttributions(
    partnerId: string,
    query: { from?: string; to?: string; page?: number; limit?: number },
  ) {
    const qb = this.attributionRepo
      .createQueryBuilder('a')
      .where('a.partnerId = :partnerId', { partnerId });

    if (query.from) qb.andWhere('a.createdAt >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('a.createdAt <= :to', { to: new Date(query.to) });

    qb.orderBy('a.createdAt', 'DESC');
    const page = query.page || 1;
    const limit = query.limit || 50;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async summary(partnerId: string, from?: Date, to?: Date) {
    const qb = this.attributionRepo
      .createQueryBuilder('a')
      .select('COUNT(*)', 'bookings')
      .addSelect('COALESCE(SUM(a.bookingValueCop),0)', 'revenue')
      .addSelect('COALESCE(SUM(a.commissionCop),0)', 'commission')
      .where('a.partnerId = :partnerId', { partnerId });
    if (from) qb.andWhere('a.createdAt >= :from', { from });
    if (to) qb.andWhere('a.createdAt <= :to', { to });
    const raw = await qb.getRawOne();
    return {
      bookings: parseInt(raw.bookings, 10) || 0,
      revenueCop: parseFloat(raw.revenue) || 0,
      commissionCop: parseFloat(raw.commission) || 0,
    };
  }

  private generateAttributionCode(slug: string): string {
    const short = slug.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase();
    const rand = randomBytes(2).toString('hex');
    return `${short}${rand}`;
  }
}
