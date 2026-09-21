import { IsBoolean, IsOptional } from 'class-validator';

export class ConsentsDto {
  @IsOptional()
  @IsBoolean()
  emailOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  smsOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  doNotContact?: boolean;
}