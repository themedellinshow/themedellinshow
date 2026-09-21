import { IsString, IsNotEmpty, IsOptional, IsIn, IsUUID, IsDateString } from 'class-validator';
import { CrmTaskStatus, CrmTaskPriority } from '../entities/crm-task.entity';

const TASK_STATUSES: CrmTaskStatus[] = ['open', 'in_progress', 'done', 'cancelled'];
const TASK_PRIORITIES: CrmTaskPriority[] = ['low', 'medium', 'high', 'urgent'];

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsUUID()
  segmentId?: string;

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: CrmTaskStatus;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: CrmTaskPriority;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}