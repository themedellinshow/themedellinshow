import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { MessagingProvider, EmailProvider } from './interfaces/messaging-provider.interface';
import { NOTIFICATION_TEMPLATES } from './templates';
import { CrmQueueService } from '../crm/crm.queue.service';

export interface NotifyUserParams {
  userId: string;
  email?: string;
  phone?: string;
  type: keyof typeof NOTIFICATION_TEMPLATES;
  variables: Record<string, string>;
  language: 'es' | 'en' | 'pt';
  channels?: ('email' | 'whatsapp' | 'sms')[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject('MESSAGING_PROVIDER')
    private messagingProvider: MessagingProvider,
    @Inject('EMAIL_PROVIDER')
    private emailProvider: EmailProvider,
    @InjectQueue('notifications')
    private notificationQueue: Queue,
    private crmQueue: CrmQueueService,
  ) {}

  async notify(params: NotifyUserParams): Promise<void> {
    // Queue the notification for async processing
    await this.notificationQueue.add('send-notification', params);
  }

  async processNotification(params: NotifyUserParams): Promise<void> {
    const template = NOTIFICATION_TEMPLATES[params.type];
    if (!template) {
      this.logger.warn(`Unknown notification type: ${params.type}`);
      return;
    }

    const channels = params.channels || ['email'];

    for (const channel of channels) {
      try {
        if (channel === 'email' && params.email) {
          await this.emailProvider.sendEmail({
            to: params.email,
            subject: template.subject[params.language],
            template: template.emailTemplateId,
            variables: params.variables,
            language: params.language,
          });
          await this.trackDelivery('email_sent', channel, params);
        }

        if (channel === 'whatsapp' && params.phone) {
          await this.messagingProvider.sendWhatsApp({
            to: params.phone,
            template: template.whatsappTemplate[params.language],
            variables: params.variables,
            language: params.language,
          });
          await this.trackDelivery('whatsapp_sent', channel, params);
        }

        if (channel === 'sms' && params.phone) {
          await this.messagingProvider.sendSMS({
            to: params.phone,
            template: template.smsTemplate[params.language],
            variables: params.variables,
            language: params.language,
          });
          await this.trackDelivery('sms_sent', channel, params);
        }
      } catch (error) {
        this.logger.error(`Failed to send ${channel} notification: ${error}`);
      }
    }
  }

  private trackDelivery(
    type: 'email_sent' | 'whatsapp_sent' | 'sms_sent',
    channel: 'email' | 'whatsapp' | 'sms',
    params: NotifyUserParams,
  ): Promise<void> {
    return this.crmQueue.trackInteraction({
      userId: params.userId,
      email: params.email,
      type,
      channel,
      subject: `Notification: ${params.type}`,
      metadata: { notificationType: params.type, language: params.language },
    });
  }

  // Convenience methods
  async notifyBookingCreated(booking: any, traveler: any): Promise<void> {
    await this.notify({
      userId: traveler.id,
      email: traveler.email,
      phone: traveler.phone,
      type: 'BOOKING_CREATED',
      variables: {
        name: traveler.firstName,
        bookingRef: booking.bookingReference,
        experienceName: booking.experience?.titleEn || '',
        date: booking.bookingDate,
        time: booking.startTime,
      },
      language: traveler.preferredLanguage,
      channels: ['email', 'whatsapp'],
    });
  }

  async notifyBookingConfirmed(booking: any, traveler: any): Promise<void> {
    await this.notify({
      userId: traveler.id,
      email: traveler.email,
      phone: traveler.phone,
      type: 'BOOKING_CONFIRMED',
      variables: {
        name: traveler.firstName,
        bookingRef: booking.bookingReference,
        experienceName: booking.experience?.titleEn || '',
        date: booking.bookingDate,
        time: booking.startTime,
        meetingPoint: booking.experience?.meetingPointEn || '',
      },
      language: traveler.preferredLanguage,
      channels: ['email', 'whatsapp'],
    });
  }

  async notifyPaymentReceived(booking: any, traveler: any): Promise<void> {
    await this.notify({
      userId: traveler.id,
      email: traveler.email,
      type: 'PAYMENT_RECEIVED',
      variables: {
        name: traveler.firstName,
        bookingRef: booking.bookingReference,
        amount: booking.totalCop.toString(),
        currency: booking.currencyPaid,
      },
      language: traveler.preferredLanguage,
      channels: ['email'],
    });
  }

  async notifyHostNewBooking(booking: any, host: any): Promise<void> {
    await this.notify({
      userId: host.id,
      email: host.email,
      phone: host.phone,
      type: 'HOST_NEW_BOOKING',
      variables: {
        name: host.firstName,
        bookingRef: booking.bookingReference,
        experienceName: booking.experience?.titleEs || '',
        date: booking.bookingDate,
        participants: booking.participants.toString(),
      },
      language: host.preferredLanguage || 'es',
      channels: ['email', 'whatsapp'],
    });
  }

  async notifyBookingReminder(booking: any, traveler: any): Promise<void> {
    await this.notify({
      userId: traveler.id,
      email: traveler.email,
      phone: traveler.phone,
      type: 'BOOKING_REMINDER',
      variables: {
        name: traveler.firstName,
        experienceName: booking.experience?.titleEn || '',
        time: booking.startTime,
        meetingPoint: booking.experience?.meetingPointEn || '',
      },
      language: traveler.preferredLanguage,
      channels: ['email', 'whatsapp'],
    });
  }
}
