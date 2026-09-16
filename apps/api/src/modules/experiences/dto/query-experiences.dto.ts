import { IsOptional, IsString, IsNumber, IsBoolean, IsIn, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ExperienceCategory } from '../entities/experience.entity';

export class QueryExperiencesDto {
  @IsOptional()
  @IsIn(['cultural', 'gastronomic', 'nightlife', 'adventure', 'wellness', 'lgbtq', 'local-life'])
  category?: ExperienceCategory;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  participants?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  lgbtqFriendly?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['es', 'en', 'pt'])
  lang?: 'es' | 'en' | 'pt';

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
  @IsIn(['price', 'rating', 'created', 'popular'])
  sortBy?: 'price' | 'rating' | 'created' | 'popular';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
