import { IsOptional, IsString, IsNumber, IsBoolean, IsIn, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryCompanionsDto {
  @IsOptional()
  @IsString()
  service?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxHourlyRate?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  lgbtqFriendly?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  verifiedOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @IsIn(['rate', 'rating', 'created'])
  sortBy?: 'rate' | 'rating' | 'created';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
