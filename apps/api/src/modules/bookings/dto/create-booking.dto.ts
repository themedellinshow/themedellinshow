import { IsUUID, IsDateString, IsString, IsNumber, IsOptional, IsEmail, Min, Matches } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  experienceId: string;

  @IsDateString()
  bookingDate: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'startTime must be HH:mm format' })
  startTime: string;

  @IsNumber()
  @Min(1)
  participants: number;

  @IsOptional()
  @IsString()
  specialRequests?: string;

  @IsEmail()
  contactEmail: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}
