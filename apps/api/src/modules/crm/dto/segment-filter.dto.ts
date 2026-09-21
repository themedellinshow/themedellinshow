import { IsString, IsNotEmpty, IsOptional, ValidateNested, IsIn, IsInt, Min, ArrayUnique, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { LifecycleStage, LeadSource } from '../entities/crm-contact.entity';

export class SegmentFilterDto {
  @IsOptional()
  @IsIn(['lead', 'prospect', 'customer', 'champion'])
  lifecycleStage?: LifecycleStage;

  @IsOptional()
  @IsIn(['concierge', 'ad', 'referral', 'organic', 'marketplace', 'partner'])
  leadSource?: LeadSource;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadScoreMin?: number;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString({ each: true })
  @ArrayUnique()
  tags?: string[];

  @IsOptional()
  @IsString({ each: true })
  @ArrayUnique()
  interests?: string[];

  @IsOptional()
  @IsBoolean()
  emailOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  smsOptIn?: boolean;
}