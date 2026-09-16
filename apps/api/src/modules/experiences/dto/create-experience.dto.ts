import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { ExperienceCategory } from '../entities/experience.entity';

export class CreateExperienceDto {
  @IsString()
  titleEs: string;

  @IsString()
  titleEn: string;

  @IsOptional()
  @IsString()
  titlePt?: string;

  @IsString()
  descriptionEs: string;

  @IsString()
  descriptionEn: string;

  @IsOptional()
  @IsString()
  descriptionPt?: string;

  @IsIn(['cultural', 'gastronomic', 'nightlife', 'adventure', 'wellness', 'lgbtq', 'local-life'])
  category: ExperienceCategory;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsNumber()
  @Min(0)
  priceCop: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceUsd?: number;

  @IsNumber()
  @Min(15)
  durationMinutes: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minParticipants?: number;

  @IsNumber()
  @Min(1)
  @Max(100)
  maxParticipants: number;

  @IsString()
  neighborhood: string;

  @IsOptional()
  @IsString()
  meetingPointEs?: string;

  @IsOptional()
  @IsString()
  meetingPointEn?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsBoolean()
  lgbtqFriendly?: boolean;

  @IsOptional()
  @IsBoolean()
  accessibleFriendly?: boolean;

  @IsOptional()
  @IsBoolean()
  familyFriendly?: boolean;
}
