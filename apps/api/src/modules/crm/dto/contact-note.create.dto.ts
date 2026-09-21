import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class CreateContactNoteDto {
  @IsString()
  @IsNotEmpty()
  body: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}