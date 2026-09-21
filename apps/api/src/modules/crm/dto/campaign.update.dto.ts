import {
  IsString,
  IsOptional,
  IsIn,
  IsUUID,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignChannel, CampaignStatus } from '../entities/crm-campaign.entity';
import { SegmentFilterDto } from './segment-filter.dto';

const CAMPAIGN_CHANNELS: CampaignChannel[] = ['email', 'whatsapp', 'sms'];
const CAMPAIGN_STATUSES: CampaignStatus[] = [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'completed',
  'cancelled',
];

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(CAMPAIGN_CHANNELS)
  channel?: CampaignChannel;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  providerTemplateId?: string;

  @IsOptional()
  @IsUUID()
  segmentId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SegmentFilterDto)
  contactCriteria?: SegmentFilterDto;

  @IsOptional()
  @IsIn(CAMPAIGN_STATUSES)
  status?: CampaignStatus;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}