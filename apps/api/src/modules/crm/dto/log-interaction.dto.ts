import {
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  InteractionChannel,
  InteractionType,
} from '../entities/crm-interaction.entity';

const INTERACTION_TYPES: InteractionType[] = [
  'email_sent',
  'email_opened',
  'whatsapp_sent',
  'whatsapp_replied',
  'sms_sent',
  'concierge_chat',
  'booking_created',
  'booking_confirmed',
  'booking_paid',
  'booking_completed',
  'booking_cancelled',
  'review_submitted',
  'note',
];

const INTERACTION_CHANNELS: InteractionChannel[] = [
  'email',
  'whatsapp',
  'sms',
  'app',
  'concierge',
  'manual',
];

export class LogInteractionDto {
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsIn(INTERACTION_TYPES)
  type: InteractionType;

  @IsIn(INTERACTION_CHANNELS)
  channel: InteractionChannel;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}