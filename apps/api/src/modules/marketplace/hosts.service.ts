import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HostProfile, HostStatus } from './entities/host-profile.entity';
import { CreateHostProfileDto } from './dto/create-host-profile.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class HostsService {
  constructor(
    @InjectRepository(HostProfile)
    private hostRepo: Repository<HostProfile>,
    private usersService: UsersService,
  ) {}

  async createProfile(userId: string, dto: CreateHostProfileDto): Promise<HostProfile> {
    const existing = await this.hostRepo.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException('Host profile already exists');
    }

    const profile = this.hostRepo.create({
      userId,
      ...dto,
      status: 'pending_verification',
    });

    const saved = await this.hostRepo.save(profile);

    // Promote user role to host
    await this.usersService.updateRole(userId, 'host');

    return saved;
  }

  async findAll(query: {
    featured?: boolean;
    superHost?: boolean;
    verifiedOnly?: boolean;
    page?: number;
    limit?: number;
  }) {
    const qb = this.hostRepo
      .createQueryBuilder('host')
      .leftJoinAndSelect('host.user', 'user')
      .where('host.status = :status', { status: 'active' });

    if (query.featured) qb.andWhere('host.featured = true');
    if (query.superHost) qb.andWhere('host.superHost = true');
    if (query.verifiedOnly) qb.andWhere('host.identityVerified = true');

    qb.orderBy('host.superHost', 'DESC')
      .addOrderBy('host.averageRating', 'DESC');

    const page = query.page || 1;
    const limit = query.limit || 20;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<HostProfile> {
    const profile = await this.hostRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!profile) {
      throw new NotFoundException('Host profile not found');
    }
    return profile;
  }

  async findByUserId(userId: string): Promise<HostProfile | null> {
    return this.hostRepo.findOne({ where: { userId }, relations: ['user'] });
  }

  async update(id: string, userId: string, dto: Partial<CreateHostProfileDto>): Promise<HostProfile> {
    const profile = await this.findById(id);
    if (profile.userId !== userId) {
      throw new ForbiddenException('Not authorized');
    }
    Object.assign(profile, dto);
    return this.hostRepo.save(profile);
  }

  async verify(id: string, checks: { identity?: boolean; address?: boolean }): Promise<HostProfile> {
    const profile = await this.findById(id);
    if (checks.identity !== undefined) profile.identityVerified = checks.identity;
    if (checks.address !== undefined) profile.addressVerified = checks.address;

    if (profile.identityVerified && profile.addressVerified) {
      profile.verifiedAt = new Date();
      profile.status = 'active';
    }

    return this.hostRepo.save(profile);
  }

  async updateStatus(id: string, status: HostStatus): Promise<HostProfile> {
    const profile = await this.findById(id);
    profile.status = status;
    return this.hostRepo.save(profile);
  }

  async setSuperHost(id: string, superHost: boolean): Promise<HostProfile> {
    const profile = await this.findById(id);
    profile.superHost = superHost;
    return this.hostRepo.save(profile);
  }

  async setPayoutInfo(userId: string, last4: string): Promise<HostProfile> {
    const profile = await this.findByUserId(userId);
    if (!profile) throw new NotFoundException('Host profile not found');
    profile.bankAccountLast4 = last4;
    profile.payoutSetupComplete = true;
    return this.hostRepo.save(profile);
  }
}
