import { IsString, Matches, MinLength, IsOptional, IsIn } from 'class-validator';

export class RedeemReferralDto {
  /**
   * Code the new user typed at signup or on a sharable link,
   * e.g. "HECTOR-M32F"
   */
  @IsString()
  @MinLength(6)
  @Matches(/^[A-Za-z0-9-]+$/, { message: 'code must be alphanumeric with dashes' })
  code: string;

  @IsOptional()
  @IsString()
  sourceContext?: string;
}

export class ReferralAddressDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['es', 'en', 'pt'])
  language?: 'es' | 'en' | 'pt';
}