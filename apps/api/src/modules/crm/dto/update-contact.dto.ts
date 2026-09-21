import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { LeadSource, LifecycleStage } from '../entities/crm-contact.entity';

const LEAD_SOURCES: LeadSource[] = [
  'organic',
  'referral',
  'social',
  'ads',
  'concierge',
  'partner',
  'other',
];

const LIFECYCLE_STAGES: LifecycleStage[] = [
  'lead',
  'prospect',
  'customer',
  'repeat_customer',
  'inactive',
];

export class UpdateContactDto {
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
  country?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  pronouns?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(LEAD_SOURCES)
  leadSource?: LeadSource;

  @IsOptional()
  @IsIn(LIFECYCLE_STAGES)
  lifecycleStage?: LifecycleStage;

  @IsOptional()
  @IsBoolean()
  doNotContact?: boolean;
}