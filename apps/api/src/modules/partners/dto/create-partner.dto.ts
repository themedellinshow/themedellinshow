import {
  IsString,
  IsEmail,
  IsOptional,
  IsIn,
  IsNumber,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { PartnerType, PartnerTier } from '../entities/partner.entity';

export class CreatePartnerDto {
  @IsString()
  slug: string;

  @IsString()
  legalName: string;

  @IsString()
  displayName: string;

  @IsIn(['hotel', 'hostel', 'agency', 'venue', 'restaurant', 'media', 'affiliate', 'other'])
  partnerType: PartnerType;

  @IsOptional()
  @IsIn(['standard', 'preferred', 'strategic'])
  tier?: PartnerTier;

  @IsEmail()
  contactEmail: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  commissionPercent?: number;

  @IsOptional()
  @IsIn(['COP', 'USD'])
  payoutCurrency?: 'COP' | 'USD';

  @IsOptional()
  @IsString()
  attributionCode?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
