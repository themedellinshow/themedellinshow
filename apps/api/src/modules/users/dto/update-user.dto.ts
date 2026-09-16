import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsIn(['es', 'en', 'pt'])
  preferredLanguage?: 'es' | 'en' | 'pt';

  @IsOptional()
  @IsIn(['COP', 'USD'])
  preferredCurrency?: 'COP' | 'USD';

  @IsOptional()
  @IsString()
  country?: string;
}
