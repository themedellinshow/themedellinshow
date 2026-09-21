import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import { TwilioProvider } from './providers/twilio.provider';
import { SendGridProvider } from './providers/sendgrid.provider';
import { CrmModule } from '../crm/crm.module';

@Module({
  imports: [BullModule.registerQueue({ name: 'notifications' }), CrmModule],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    TwilioProvider,
    SendGridProvider,
    {
      provide: 'MESSAGING_PROVIDER',
      useExisting: TwilioProvider,
    },
    {
      provide: 'EMAIL_PROVIDER',
      useExisting: SendGridProvider,
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
