import { IsOptional, IsString, IsIn, MinLength, MaxLength } from 'class-validator';

/**
 * Host payout/fiscal setup. Tax rules are NOT enforced here; the fields just
 * store the provider's fiscal information so retention/withholding rules can
 * be configured later (validated with a Colombian accountant before real payouts).
 */
export class UpdateHostPayoutDto {
  @IsString()
  @MinLength(4)
  @MaxLength(4)
  last4: string;

  @IsOptional()
  @IsIn(['COP', 'USD'])
  payoutCurrency?: 'COP' | 'USD';

  @IsOptional()
  @IsString()
  fiscalDocumentType?: string;

  @IsOptional()
  @IsString()
  fiscalCountry?: string;
}