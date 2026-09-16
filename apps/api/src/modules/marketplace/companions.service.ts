import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanionProfile, CompanionStatus } from './entities/companion-profile.entity';
import { CreateCompanionProfileDto } from './dto/create-companion-profile.dto';
import { QueryCompanionsDto } from './dto/query-companions.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class CompanionsService {
  constructor(
    @InjectRepository(CompanionProfile)
    private companionRepo: Repository<CompanionProfile>,
    private usersService: UsersService,
  ) {}

  async createProfile(userId: string, dto: CreateCompanionProfileDto): Promise<CompanionProfile> {
    const existing = await this.companionRepo.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException('Companion profile already exists');
    }

    const profile = this.companionRepo.create({
      userId,
      ...dto,
      status: 'pending_verification',
    });

    const saved = await this.companionRepo.save(profile);

    // Promote user role to companion
    await this.usersService.updateRole(userId, 'companion');

    return saved;
  }

  async findAll(query: QueryCompanionsDto) {
    const qb = this.companionRepo
      .createQueryBuilder('companion')
      .leftJoinAndSelect('companion.user', 'user')
      .where('companion.status = :status', { status: 'active' });

    if (query.service) {
      qb.andWhere('companion.services LIKE :service', { service: `%${query.service}%` });
    }

    if (query.language) {
      qb.andWhere('companion.languagesSpoken LIKE :language', { language: `%${query.language}%` });
    }

    if (query.neighborhood) {
      qb.andWhere('companion.neighborhoods LIKE :neighborhood', {
        neighborhood: `%${query.neighborhood}%`,
      });
    }

    if (query.maxHourlyRate !== undefined) {
      qb.andWhere('companion.hourlyRateCop <= :maxRate', { maxRate: query.maxHourlyRate });
    }

    if (query.lgbtqFriendly) {
      qb.andWhere('companion.lgbtqFriendly = true');
    }

    if (query.verifiedOnly) {
      qb.andWhere('companion.identityVerified = true');
    }

    const sortMap = {
      rate: 'companion.hourlyRateCop',
      rating: 'companion.averageRating',
      created: 'companion.createdAt',
    };
    qb.orderBy(sortMap[query.sortBy || 'rating'], query.sortOrder?.toUpperCase() as 'ASC' | 'DESC' || 'DESC');

    const page = query.page || 1;
    const limit = query.limit || 20;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<CompanionProfile> {
    const profile = await this.companionRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!profile) {
      throw new NotFoundException('Companion profile not found');
    }
    return profile;
  }

  async findByUserId(userId: string): Promise<CompanionProfile | null> {
    return this.companionRepo.findOne({ where: { userId }, relations: ['user'] });
  }

  async update(id: string, userId: string, dto: Partial<CreateCompanionProfileDto>): Promise<CompanionProfile> {
    const profile = await this.findById(id);
    if (profile.userId !== userId) {
      throw new ForbiddenException('Not authorized to update this profile');
    }
    Object.assign(profile, dto);
    return this.companionRepo.save(profile);
  }

  async verify(id: string, checks: { identity?: boolean; background?: boolean }): Promise<CompanionProfile> {
    const profile = await this.findById(id);
    if (checks.identity !== undefined) profile.identityVerified = checks.identity;
    if (checks.background !== undefined) profile.backgroundChecked = checks.background;

    if (profile.identityVerified && profile.backgroundChecked) {
      profile.verifiedAt = new Date();
      profile.status = 'active';
    }

    return this.companionRepo.save(profile);
  }

  async updateStatus(id: string, status: CompanionStatus): Promise<CompanionProfile> {
    const profile = await this.findById(id);
    profile.status = status;
    return this.companionRepo.save(profile);
  }
}
