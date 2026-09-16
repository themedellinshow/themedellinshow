import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface TokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const exists = await this.userRepo.findOne({ where: { email: dto.email } });
    if (exists) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      preferredLanguage: dto.preferredLanguage || 'es',
      preferredCurrency: dto.preferredCurrency || 'COP',
      role: 'traveler',
    });

    await this.userRepo.save(user);
    return this.generateTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
      select: ['id', 'email', 'passwordHash', 'role', 'isActive'],
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    return this.generateTokens(user);
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<AuthTokens> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'email', 'role', 'refreshToken', 'isActive'],
    });

    if (!user || !user.isActive || !user.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const valid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!valid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.generateTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.userRepo.update(userId, { refreshToken: null });
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    const hashedRefresh = await bcrypt.hash(refreshToken, 10);
    await this.userRepo.update(user.id, { refreshToken: hashedRefresh });

    return { accessToken, refreshToken };
  }
}
