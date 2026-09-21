import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AutomationStatus } from '../entities/crm-automation.entity';
import { AutomationActionDto } from './automation.create.dto';

const AUTOMATION_STATUSES: AutomationStatus[] = ['active', 'paused', 'draft'];

export class UpdateAutomationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AutomationActionDto)
  actions?: AutomationActionDto[];

  @IsOptional()
  @IsIn(AUTOMATION_STATUSES)
  status?: AutomationStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cooldownMinutes?: number;
}

export class TriggerAutomationDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contactIds?: string[];
}