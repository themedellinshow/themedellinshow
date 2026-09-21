import { IsUUID } from 'class-validator';

export class MergeContactsDto {
  @IsUUID()
  sourceId: string;

  @IsUUID()
  targetId: string;
}