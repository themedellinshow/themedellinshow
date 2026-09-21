import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InteractionType, InteractionChannel } from './entities/crm-interaction.entity';

export type CrmBookingEventType =
  | 'created'
  | 'confirmed'
  | 'paid'
  | 'completed'
  | 'cancelled';

export interface TrackBookingPayload {
  type: CrmBookingEventType;
  email: string;
  bookingValueCop?: number;
  metadata?: Record<string, unknown>;
}

export interface TrackInteractionPayload {
  contactId?: string;
  email?: string;
  userId?: string;
  type: InteractionType;
  channel: InteractionChannel;
  subject?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface LinkUserPayload {
  email: string;
  userId: string;
}

export interface RefreshSegmentPayload {
  segmentId: string;
  trigger: string;
}

export interface RunCampaignPayload {
  campaignId: string;
  trigger: string;
}

export interface RunAutomationPayload {
  automationId: string;
  contactIds?: string[];
  trigger: string;
}

export type AutomationEventType =
  | 'contact_created'
  | 'contact_updated'
  | 'booking_confirmed'
  | 'booking_paid'
  | 'payment_received'
  | 'manual';

export interface TriggerAutomationsPayload {
  eventType: AutomationEventType;
  contactId?: string;
  userId?: string;
  email?: string;
}

@Injectable()
export class CrmQueueService {
  private readonly logger = new Logger(CrmQueueService.name);

  constructor(@InjectQueue('crm') private readonly crmQueue: Queue) {}

  async trackBooking(payload: TrackBookingPayload): Promise<void> {
    await this.add('track-booking', payload);
  }

  async trackInteraction(payload: TrackInteractionPayload): Promise<void> {
    await this.add('track-interaction', payload);
  }

  async linkUser(payload: LinkUserPayload): Promise<void> {
    await this.add('link-user', payload);
  }

  async refreshSegment(segmentId: string): Promise<void> {
    await this.add('refresh-segment', { segmentId, trigger: 'manual' });
  }

  async runCampaign(campaignId: string): Promise<void> {
    await this.add('run-campaign', { campaignId, trigger: 'manual' });
  }

  async runAutomation(automationId: string, contactIds?: string[]): Promise<void> {
    await this.add('run-automation', { automationId, contactIds, trigger: 'manual' });
  }

  async triggerAutomations(eventType: AutomationEventType, target?: { contactId?: string; userId?: string; email?: string }): Promise<void> {
    await this.add('trigger-automations', {
      eventType,
      contactId: target?.contactId,
      userId: target?.userId,
      email: target?.email,
    });
  }

  private async add(name: string, data: unknown): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await this.crmQueue.add(name, data, {
          removeOnComplete: true,
          removeOnFail: 100,
        });
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
        }
      }
    }
    // Graceful degradation: if the queue is unavailable (no Redis), the
    // event is dropped instead of failing the HTTP request.
    this.logger.warn(`CRM queue unavailable, dropping job ${name}: ${lastError}`);
  }
}