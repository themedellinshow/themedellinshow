import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(['es', 'en', 'pt'])
  preferredLanguage?: 'es' | 'en' | 'pt';

  @IsOptional()
  @IsIn(['COP', 'USD'])
  preferredCurrency?: 'COP' | 'USD';
}
