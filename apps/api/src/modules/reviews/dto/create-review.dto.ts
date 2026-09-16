import { IsUUID, IsString, IsNumber, IsOptional, IsArray, IsIn, Min, Max, MinLength, MaxLength } from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  bookingId: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  content: string;

  @IsIn(['es', 'en', 'pt'])
  language: 'es' | 'en' | 'pt';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  hostRating?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  valueRating?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  accuracyRating?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}
