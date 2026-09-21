import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AutomationStatus } from '../entities/crm-automation.entity';

const ACTION_TYPES = ['add_tags', 'log_interaction', 'create_task', 'update_lifecycle'];
const AUTOMATION_STATUSES: AutomationStatus[] = ['active', 'paused', 'draft'];

export class AutomationActionDto {
  @IsIn(ACTION_TYPES)
  type: 'add_tags' | 'log_interaction' | 'create_task' | 'update_lifecycle';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  interactionType?: string;

  @IsOptional()
  @IsString()
  interactionChannel?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  taskTitle?: string;

  @IsOptional()
  @IsString()
  taskPriority?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  dueInDays?: number;

  @IsOptional()
  @IsString()
  lifecycleStage?: string;
}

export class CreateAutomationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['contact_created', 'contact_updated', 'booking_confirmed', 'booking_paid', 'payment_received', 'manual'])
  eventType: string;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AutomationActionDto)
  actions: AutomationActionDto[];

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