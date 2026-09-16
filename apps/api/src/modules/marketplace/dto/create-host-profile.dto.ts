import { IsString, IsArray, IsOptional, IsIn } from 'class-validator';
import { HostType } from '../entities/host-profile.entity';

export class CreateHostProfileDto {
  @IsOptional()
  @IsIn(['individual', 'business'])
  hostType?: HostType;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsString()
  bioEs: string;

  @IsString()
  bioEn: string;

  @IsOptional()
  @IsString()
  bioPt?: string;

  @IsArray()
  @IsString({ each: true })
  languagesSpoken: string[];
}
