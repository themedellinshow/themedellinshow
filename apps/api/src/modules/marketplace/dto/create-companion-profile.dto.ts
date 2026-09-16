import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  IsBoolean,
  Min,
  Matches,
} from 'class-validator';

/**
 * Companion Profile Creation
 * Principle: "presence, not transactional intimacy"
 * Services must reflect cultural/social companionship only.
 */
export class CreateCompanionProfileDto {
  @IsString()
  bioEs: string;

  @IsString()
  bioEn: string;

  @IsOptional()
  @IsString()
  bioPt?: string;

  @IsArray()
  @IsString({ each: true })
  services: string[]; // e.g. ['city-tours', 'nightlife-guide', 'translation']

  @IsArray()
  @IsString({ each: true })
  languagesSpoken: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availableDays?: string[];

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  availableHoursStart?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  availableHoursEnd?: string;

  @IsNumber()
  @Min(0)
  hourlyRateCop: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  halfDayRateCop?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fullDayRateCop?: number;

  @IsOptional()
  @IsBoolean()
  lgbtqFriendly?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  neighborhoods?: string[];
}
