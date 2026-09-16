import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CrmContact,
  LeadSource,
  LifecycleStage,
} from './entities/crm-contact.entity';
import {
  CrmInteraction,
  InteractionType,
  InteractionChannel,
} from './entities/crm-interaction.entity';

export interface UpsertContactDto {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  userId?: string;
  leadSource?: LeadSource;
  interests?: string[];
  tags?: string[];
  emailOptIn?: boolean;
  whatsappOptIn?: boolean;
  smsOptIn?: boolean;
}

export interface LogInteractionDto {
  contactId?: string;
  email?: string;
  type: InteractionType;
  channel: InteractionChannel;
  subject?: string;
  content?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class CrmService {
  constructor(
    @InjectRepository(CrmContact)
    private contactRepo: Repository<CrmContact>,
    @InjectRepository(CrmInteraction)
    private interactionRepo: Repository<CrmInteraction>,
  ) {}

  async upsertContact(dto: UpsertContactDto): Promise<CrmContact> {
    let contact = await this.contactRepo.findOne({ where: { email: dto.email } });

    if (!contact) {
      contact = this.contactRepo.create({
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        country: dto.country,
        userId: dto.userId,
        leadSource: dto.leadSource || 'organic',
        lifecycleStage: 'lead',
        interests: dto.interests,
        tags: dto.tags,
        emailOptIn: dto.emailOptIn ?? false,
        whatsappOptIn: dto.whatsappOptIn ?? false,
        smsOptIn: dto.smsOptIn ?? false,
      });
    } else {
      // Merge non-null fields
      if (dto.firstName) contact.firstName = dto.firstName;
      if (dto.lastName) contact.lastName = dto.lastName;
      if (dto.phone) contact.phone = dto.phone;
      if (dto.country) contact.country = dto.country;
      if (dto.userId) contact.userId = dto.userId;
      if (dto.interests) contact.interests = dto.interests;
      if (dto.tags) contact.tags = [...(contact.tags || []), ...dto.tags];
      if (dto.emailOptIn !== undefined) contact.emailOptIn = dto.emailOptIn;
      if (dto.whatsappOptIn !== undefined) contact.whatsappOptIn = dto.whatsappOptIn;
      if (dto.smsOptIn !== undefined) contact.smsOptIn = dto.smsOptIn;
    }

    return this.contactRepo.save(contact);
  }

  async logInteraction(dto: LogInteractionDto): Promise<CrmInteraction> {
    let contactId = dto.contactId;

    if (!contactId && dto.email) {
      const contact = await this.upsertContact({ email: dto.email });
      contactId = contact.id;
    }

    if (!contactId) {
      throw new NotFoundException('Contact not identified');
    }

    const interaction = this.interactionRepo.create({
      contactId,
      type: dto.type,
      channel: dto.channel,
      subject: dto.subject,
      content: dto.content,
      metadata: dto.metadata,
    });

    // Update contact last contacted timestamp
    await this.contactRepo.update(contactId, { lastContactedAt: new Date() });

    return this.interactionRepo.save(interaction);
  }

  async recordBooking(email: string, bookingValueCop: number): Promise<CrmContact> {
    const contact = await this.upsertContact({ email });
    contact.totalBookings += 1;
    contact.lifetimeValueCop = Number(contact.lifetimeValueCop) + bookingValueCop;
    contact.lastBookingAt = new Date();
    if (!contact.firstBookingAt) {
      contact.firstBookingAt = new Date();
      contact.lifecycleStage = 'customer';
    } else if (contact.totalBookings >= 2) {
      contact.lifecycleStage = 'repeat_customer';
    }
    return this.contactRepo.save(contact);
  }

  async findByEmail(email: string): Promise<CrmContact | null> {
    return this.contactRepo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<CrmContact> {
    const contact = await this.contactRepo.findOne({ where: { id } });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async findAll(query: {
    lifecycleStage?: LifecycleStage;
    leadSource?: LeadSource;
    tag?: string;
    page?: number;
    limit?: number;
  }) {
    const qb = this.contactRepo.createQueryBuilder('contact');

    if (query.lifecycleStage) {
      qb.andWhere('contact.lifecycleStage = :stage', { stage: query.lifecycleStage });
    }

    if (query.leadSource) {
      qb.andWhere('contact.leadSource = :source', { source: query.leadSource });
    }

    if (query.tag) {
      qb.andWhere('contact.tags LIKE :tag', { tag: `%${query.tag}%` });
    }

    qb.orderBy('contact.updatedAt', 'DESC');

    const page = query.page || 1;
    const limit = query.limit || 50;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getInteractions(contactId: string): Promise<CrmInteraction[]> {
    return this.interactionRepo.find({
      where: { contactId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateLifecycleStage(id: string, stage: LifecycleStage): Promise<CrmContact> {
    const contact = await this.findById(id);
    contact.lifecycleStage = stage;
    return this.contactRepo.save(contact);
  }

  async addTags(id: string, tags: string[]): Promise<CrmContact> {
    const contact = await this.findById(id);
    contact.tags = Array.from(new Set([...(contact.tags || []), ...tags]));
    return this.contactRepo.save(contact);
  }
}
