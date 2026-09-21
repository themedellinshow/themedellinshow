import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  CrmContact,
  LeadSource,
  LifecycleStage,
} from './entities/crm-contact.entity';
import {
  CrmInteraction,
  InteractionType,
} from './entities/crm-interaction.entity';
import { ConsentsDto } from './dto/consents.dto';
import { LogInteractionDto } from './dto/log-interaction.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { UpsertContactDto } from './dto/upsert-contact.dto';
import { Booking } from '../bookings/entities/booking.entity';
import { CrmSegment } from './entities/crm-segment.entity';
import { CrmSegmentMember } from './entities/crm-segment-member.entity';
import { CrmTask, CrmTaskStatus } from './entities/crm-task.entity';
import { CreateSegmentDto, UpdateSegmentDto, CreateTaskDto, UpdateTaskDto } from './dto';
import { CrmContactNote } from './entities/crm-contact-note.entity';
import { CrmCampaignRecipient } from './entities/crm-campaign-recipient.entity';
import { CrmAutomationRun } from './entities/crm-automation-run.entity';
import { CrmAutomation } from './entities/crm-automation.entity';
import { CrmPipeline, CrmStage } from './entities/crm-pipeline.entity';

export { ConsentsDto, LogInteractionDto, UpdateContactDto, UpsertContactDto };

@Injectable()
export class CrmService {
  private static readonly SOURCE_WEIGHTS: Record<LeadSource, number> = {
    organic: 5,
    referral: 8,
    social: 6,
    ads: 7,
    concierge: 10,
    partner: 9,
    other: 5,
  };

  constructor(
    @InjectRepository(CrmContact)
    private contactRepo: Repository<CrmContact>,
    @InjectRepository(CrmInteraction)
    private interactionRepo: Repository<CrmInteraction>,
    @InjectRepository(Booking)
    private bookingRepo: Repository<Booking>,
    @InjectRepository(CrmSegment)
    private segmentRepo: Repository<CrmSegment>,
    @InjectRepository(CrmSegmentMember)
    private segmentMemberRepo: Repository<CrmSegmentMember>,
    @InjectRepository(CrmTask)
    private taskRepo: Repository<CrmTask>,
    @InjectRepository(CrmContactNote)
    private noteRepo: Repository<CrmContactNote>,
    @InjectRepository(CrmCampaignRecipient)
    private recipientRepo: Repository<CrmCampaignRecipient>,
    @InjectRepository(CrmAutomationRun)
    private automationRunRepo: Repository<CrmAutomationRun>,
    @InjectRepository(CrmPipeline)
    private pipelineRepo: Repository<CrmPipeline>,
    @InjectRepository(CrmStage)
    private stageRepo: Repository<CrmStage>,
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
        company: dto.company,
        jobTitle: dto.jobTitle,
        timezone: dto.timezone,
        pronouns: dto.pronouns,
        birthDate: dto.birthDate,
        notes: dto.notes,
      });
      contact.leadScore = this.sourceWeight(contact.leadSource);
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
      if (dto.company) contact.company = dto.company;
      if (dto.jobTitle) contact.jobTitle = dto.jobTitle;
      if (dto.timezone) contact.timezone = dto.timezone;
      if (dto.pronouns) contact.pronouns = dto.pronouns;
      if (dto.birthDate) contact.birthDate = dto.birthDate;
      if (dto.notes) contact.notes = dto.notes;
      if (dto.leadSource) contact.leadSource = dto.leadSource;
      contact.leadScore = await this.computeLeadScore(contact);
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

    // Update contact last contacted timestamp + engagement columns
    const fresh = await this.contactRepo.findOne({ where: { id: contactId } });
    const engagement: Record<string, unknown> = { lastContactedAt: new Date() };
    if (fresh) {
      if (dto.type === 'email_opened') engagement.lastEmailOpenAt = new Date();
      if (dto.type === 'whatsapp_replied') engagement.lastWhatsappReplyAt = new Date();
      engagement.leadScore = await this.computeLeadScore({
        ...fresh,
        leadScore: fresh.leadScore,
      });
      await this.contactRepo.update(contactId, engagement);
    } else {
      await this.contactRepo.update(contactId, { lastContactedAt: new Date() });
    }

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
    contact.leadScore = await this.computeLeadScore(contact);
    return this.contactRepo.save(contact);
  }

  async updateContact(id: string, dto: UpdateContactDto): Promise<CrmContact> {
    const contact = await this.findById(id);

    if (dto.firstName !== undefined) contact.firstName = dto.firstName;
    if (dto.lastName !== undefined) contact.lastName = dto.lastName;
    if (dto.phone !== undefined) contact.phone = dto.phone;
    if (dto.country !== undefined) contact.country = dto.country;
    if (dto.company !== undefined) contact.company = dto.company;
    if (dto.jobTitle !== undefined) contact.jobTitle = dto.jobTitle;
    if (dto.timezone !== undefined) contact.timezone = dto.timezone;
    if (dto.pronouns !== undefined) contact.pronouns = dto.pronouns;
    if (dto.birthDate !== undefined) contact.birthDate = dto.birthDate;
    if (dto.notes !== undefined) contact.notes = dto.notes;
    if (dto.interests !== undefined) contact.interests = dto.interests;
    if (dto.tags !== undefined) contact.tags = dto.tags;
    if (dto.leadSource !== undefined) contact.leadSource = dto.leadSource;
    if (dto.lifecycleStage !== undefined) contact.lifecycleStage = dto.lifecycleStage;
    if (dto.doNotContact !== undefined) {
      contact.doNotContact = dto.doNotContact;
      if (dto.doNotContact && !contact.unsubscribedAt) {
        contact.unsubscribedAt = new Date();
      }
    }

    contact.leadScore = await this.computeLeadScore(contact);
    return this.contactRepo.save(contact);
  }

  async updateConsents(id: string, dto: ConsentsDto): Promise<CrmContact> {
    const contact = await this.findById(id);

    if (dto.emailOptIn !== undefined) contact.emailOptIn = dto.emailOptIn;
    if (dto.whatsappOptIn !== undefined) contact.whatsappOptIn = dto.whatsappOptIn;
    if (dto.smsOptIn !== undefined) contact.smsOptIn = dto.smsOptIn;
    if (dto.doNotContact !== undefined) {
      contact.doNotContact = dto.doNotContact;
      if (dto.doNotContact && !contact.unsubscribedAt) {
        contact.unsubscribedAt = new Date();
      }
      if (!dto.doNotContact) {
        contact.unsubscribedAt = null;
      }
    }

    return this.contactRepo.save(contact);
  }

  async exportCsv(ids?: string[]): Promise<string> {
    const qb = this.contactRepo.createQueryBuilder('contact');
    if (ids && ids.length) {
      qb.where('contact.id IN (:...ids)', { ids });
    }
    qb.orderBy('contact.createdAt', 'ASC');
    const contacts = await qb.getMany();

    const header = [
      'id',
      'email',
      'firstName',
      'lastName',
      'phone',
      'country',
      'company',
      'jobTitle',
      'timezone',
      'leadSource',
      'lifecycleStage',
      'leadScore',
      'totalBookings',
      'lifetimeValueCop',
      'interests',
      'tags',
      'emailOptIn',
      'whatsappOptIn',
      'smsOptIn',
      'doNotContact',
      'createdAt',
      'updatedAt',
    ];

    const escape = (value: unknown): string => {
      const s = value === null || value === undefined ? '' : String(value);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const rows = contacts.map((c) =>
      [
        c.id,
        c.email,
        c.firstName,
        c.lastName,
        c.phone,
        c.country,
        c.company,
        c.jobTitle,
        c.timezone,
        c.leadSource,
        c.lifecycleStage,
        c.leadScore,
        c.totalBookings,
        Number(c.lifetimeValueCop).toString(),
        (c.interests || []).join('|'),
        (c.tags || []).join('|'),
        c.emailOptIn,
        c.whatsappOptIn,
        c.smsOptIn,
        c.doNotContact,
        c.createdAt,
        c.updatedAt,
      ]
        .map(escape)
        .join(','),
    );

    return [header.map(escape).join(','), ...rows].join('\r\n');
  }

  async findByEmail(email: string): Promise<CrmContact | null> {
    return this.contactRepo.findOne({ where: { email } });
  }

  async findContactsByIds(ids: string[]): Promise<CrmContact[]> {
    if (ids.length === 0) return [];
    return this.contactRepo.find({ where: { id: In(ids) } });
  }

  async findById(id: string): Promise<CrmContact> {
    const contact = await this.contactRepo.findOne({ where: { id } });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async findAll(query: {
    email?: string;
    lifecycleStage?: LifecycleStage;
    leadSource?: LeadSource;
    tag?: string;
    page?: number;
    limit?: number;
  }) {
    const qb = this.contactRepo.createQueryBuilder('contact');

    if (query.email) {
      qb.andWhere('contact.email = :email', { email: query.email });
    }

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
    await this.contactRepo.manager.transaction(async (manager) => {
      const contact = await manager.findOne(CrmContact, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!contact) {
        throw new NotFoundException('Contact not found');
      }
      contact.tags = Array.from(new Set([...(contact.tags || []), ...tags]));
      await manager.save(contact);
    });
    return this.findById(id);
  }

  private sourceWeight(source: LeadSource): number {
    return CrmService.SOURCE_WEIGHTS[source] ?? 5;
  }

  /**
   * Idempotent backfill: replicate processed bookings (paid/completed) into
   * CRM contacts + interactions. Runs guarded by the bookingId metadata on the
   * interaction row, so re-running never double-counts LTV.
   */
  async runBackfill(): Promise<{
    processed: number;
    newContacts: number;
    interactionsLogged: number;
    skipped: number;
  }> {
    const bookings = await this.bookingRepo
      .createQueryBuilder('b')
      .where("b.status IN ('paid','completed')")
      .orderBy('b.createdAt', 'ASC')
      .getMany();

    let processed = 0;
    let newContacts = 0;
    let interactionsLogged = 0;
    let skipped = 0;

    for (const booking of bookings) {
      const type: InteractionType =
        booking.status === 'paid' ? 'booking_paid' : 'booking_completed';

      const already = await this.interactionRepo
        .createQueryBuilder('i')
        .where('i.type = :type', { type })
        .andWhere('i.metadata @> :md', { md: JSON.stringify({ bookingId: booking.id }) })
        .getCount();

      if (already > 0) {
        skipped += 1;
        continue;
      }

      const existing = await this.findByEmail(booking.contactEmail);
      const contact = await this.recordBooking(booking.contactEmail, Number(booking.totalCop));
      if (!existing) newContacts += 1;

      await this.interactionRepo.save(
        this.interactionRepo.create({
          contactId: contact.id,
          type,
          channel: 'app',
          subject: booking.bookingReference,
          metadata: {
            bookingId: booking.id,
            bookingReference: booking.bookingReference,
            backfilled: true,
          },
        }),
      );

      processed += 1;
      interactionsLogged += 1;
    }

    return { processed, newContacts, interactionsLogged, skipped };
  }

  // ---------------------------------------------------------------------------
  // Segments
  // ---------------------------------------------------------------------------

  async createSegment(ownerId: string, dto: CreateSegmentDto): Promise<CrmSegment> {
    const segment = this.segmentRepo.create({
      name: dto.name,
      description: dto.description,
      filter: (dto.filter as unknown as Record<string, unknown>) ?? undefined,
      ownerId,
    });
    return this.segmentRepo.save(segment);
  }

  async listSegments(query: {
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const qb = this.segmentRepo.createQueryBuilder('s');

    if (query.isActive !== undefined) {
      qb.andWhere('s.isActive = :isActive', { isActive: query.isActive });
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    qb.orderBy('s.updatedAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    const counts = await this.segmentMemberRepo
      .createQueryBuilder('m')
      .select('m.segmentId', 'segmentId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('m.segmentId')
      .getRawMany();

    const countMap = new Map<string, number>(
      counts.map((c) => [c.segmentId, Number(c.count)]),
    );

    return {
      items: items.map((s) => ({ ...s, memberCount: countMap.get(s.id) ?? 0 })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getSegment(id: string, page = 1, limit = 50) {
    const segment = await this.segmentRepo.findOne({ where: { id } });
    if (!segment) throw new NotFoundException('Segment not found');

    const memberCount = await this.segmentMemberRepo.count({ where: { segmentId: id } });

    const members = await this.segmentMemberRepo
      .createQueryBuilder('m')
      .select('m.contactId', 'contactId')
      .where('m.segmentId = :id', { id })
      .orderBy('m.contactId', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getRawMany();

    const memberIds = members.map((m) => m.contactId);

    return {
      ...segment,
      memberCount,
      members: memberIds,
      meta: { page, limit, total: memberCount, totalPages: Math.ceil(memberCount / limit) },
    };
  }

  async updateSegment(id: string, dto: UpdateSegmentDto): Promise<CrmSegment> {
    const segment = await this.segmentRepo.findOne({ where: { id } });
    if (!segment) throw new NotFoundException('Segment not found');

    if (dto.name !== undefined) segment.name = dto.name;
    if (dto.description !== undefined) segment.description = dto.description;
    if (dto.filter !== undefined) {
      segment.filter = dto.filter as unknown as Record<string, unknown>;
    }
    if (dto.isActive !== undefined) segment.isActive = dto.isActive;

    return this.segmentRepo.save(segment);
  }

  async deleteSegment(id: string): Promise<void> {
    const segment = await this.segmentRepo.findOne({ where: { id } });
    if (!segment) throw new NotFoundException('Segment not found');
    await this.segmentMemberRepo.delete({ segmentId: id });
    await this.segmentRepo.delete(id);
  }

  /**
   * Evaluate the segment filter and replace its membership. Operates in a
   * single transaction so a refresh always leaves a consistent snapshot.
   */
  async refreshSegment(id: string): Promise<{ segmentId: string; memberCount: number }> {
    const segment = await this.segmentRepo.findOne({ where: { id } });
    if (!segment) throw new NotFoundException('Segment not found');

    const matching = await this.findContactsByFilter(segment.filter || {});

    await this.segmentMemberRepo.manager.transaction(async (em) => {
      await em.delete(CrmSegmentMember, { segmentId: id });
      if (matching.length > 0) {
        await em
          .createQueryBuilder()
          .insert()
          .into(CrmSegmentMember)
          .values(matching.map((c) => ({ segmentId: id, contactId: c.id })))
          .execute();
      }
    });

    return { segmentId: id, memberCount: matching.length };
  }

  /**
   * Resolve a set of contacts against a CRM filter (used by segments refresh
   * and campaign audience resolution).
   */
  async findContactsByFilter(filter: Record<string, unknown>): Promise<CrmContact[]> {
    const qb = this.contactRepo.createQueryBuilder('c');

    const stage = filter.lifecycleStage as string | undefined;
    if (stage) qb.andWhere('c.lifecycleStage = :stage', { stage });

    const source = filter.leadSource as string | undefined;
    if (source) qb.andWhere('c.leadSource = :source', { source });

    const leadScoreMin = filter.leadScoreMin as number | undefined;
    if (leadScoreMin !== undefined) {
      qb.andWhere('c.leadScore >= :leadScoreMin', { leadScoreMin });
    }

    const country = filter.country as string | undefined;
    if (country) qb.andWhere('c.country = :country', { country });

    const tags = filter.tags as string[] | undefined;
    if (tags && tags.length > 0) {
      for (const tag of tags) {
        qb.andWhere('c.tags LIKE :like', { like: `%${tag}%` });
      }
    }

    const interests = filter.interests as string[] | undefined;
    if (interests && interests.length > 0) {
      for (const interest of interests) {
        qb.andWhere('c.interests LIKE :like', { like: `%${interest}%` });
      }
    }

    if (typeof filter.emailOptIn === 'boolean') {
      qb.andWhere('c.emailOptIn = :emailOptIn', { emailOptIn: filter.emailOptIn });
    }
    if (typeof filter.whatsappOptIn === 'boolean') {
      qb.andWhere('c.whatsappOptIn = :whatsappOptIn', { whatsappOptIn: filter.whatsappOptIn });
    }
    if (typeof filter.smsOptIn === 'boolean') {
      qb.andWhere('c.smsOptIn = :smsOptIn', { smsOptIn: filter.smsOptIn });
    }

    return qb.getMany();
  }

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  async createTask(dto: CreateTaskDto): Promise<CrmTask> {
    const task = this.taskRepo.create({
      title: dto.title,
      description: dto.description,
      assigneeId: dto.assigneeId,
      contactId: dto.contactId,
      segmentId: dto.segmentId,
      status: dto.status ?? 'open',
      priority: dto.priority ?? 'medium',
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      completedAt: dto.status === 'done' ? new Date() : null,
    });
    return this.taskRepo.save(task);
  }

  async listTasks(query: {
    assigneeId?: string;
    contactId?: string;
    segmentId?: string;
    status?: CrmTaskStatus;
    priority?: string;
    page?: number;
    limit?: number;
  }) {
    const qb = this.taskRepo.createQueryBuilder('t');

    if (query.assigneeId) qb.andWhere('t.assigneeId = :assigneeId', { assigneeId: query.assigneeId });
    if (query.contactId) qb.andWhere('t.contactId = :contactId', { contactId: query.contactId });
    if (query.segmentId) qb.andWhere('t.segmentId = :segmentId', { segmentId: query.segmentId });
    if (query.status) qb.andWhere('t.status = :status', { status: query.status });
    if (query.priority) qb.andWhere('t.priority = :priority', { priority: query.priority });

    const page = query.page || 1;
    const limit = query.limit || 50;
    qb.orderBy('t.updatedAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getTask(id: string): Promise<CrmTask> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async updateTask(id: string, dto: UpdateTaskDto): Promise<CrmTask> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.assigneeId !== undefined) task.assigneeId = dto.assigneeId;
    if (dto.contactId !== undefined) task.contactId = dto.contactId;
    if (dto.segmentId !== undefined) task.segmentId = dto.segmentId;
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.dueAt !== undefined) task.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;

    if (dto.status !== undefined) {
      task.status = dto.status;
      if (dto.status === 'done' && !task.completedAt) {
        task.completedAt = new Date();
      }
      if (dto.status !== 'done') {
        task.completedAt = null;
      }
    }

    return this.taskRepo.save(task);
  }

  async deleteTask(id: string): Promise<void> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    await this.taskRepo.delete(id);
  }

  // ---------------------------------------------------------------------------
  // Contact notes
  // ---------------------------------------------------------------------------

  async listContactNotes(contactId: string): Promise<CrmContactNote[]> {
    await this.findById(contactId);
    return this.noteRepo.find({
      where: { contactId },
      order: { createdAt: 'DESC' },
    });
  }

  async addContactNote(
    contactId: string,
    authorUserId: string,
    body: string,
    metadata?: Record<string, unknown>,
  ): Promise<CrmContactNote> {
    await this.findById(contactId);
    return this.noteRepo.save(
      this.noteRepo.create({ contactId, authorUserId, body, metadata }),
    );
  }

  async deleteContactNote(contactId: string, noteId: string): Promise<void> {
    await this.findById(contactId);
    const note = await this.noteRepo.findOne({ where: { id: noteId, contactId } });
    if (!note) throw new NotFoundException('Note not found');
    await this.noteRepo.delete(note.id);
  }

  // ---------------------------------------------------------------------------
  // Tags
  // ---------------------------------------------------------------------------

  async listTags(): Promise<{ name: string; count: number }[]> {
    const contacts = await this.contactRepo.find({ select: ['id', 'tags'] });
    const counts = new Map<string, number>();

    for (const contact of contacts) {
      for (const tag of contact.tags ?? []) {
        if (!tag) continue;
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  // ---------------------------------------------------------------------------
  // Merge
  // ---------------------------------------------------------------------------

  async mergeContacts(sourceId: string, targetId: string): Promise<CrmContact> {
    if (sourceId === targetId) {
      throw new BadRequestException('Cannot merge a contact into itself');
    }

    const source = await this.contactRepo.findOne({ where: { id: sourceId } });
    const target = await this.contactRepo.findOne({ where: { id: targetId } });
    if (!source) throw new NotFoundException('Source contact not found');
    if (!target) throw new NotFoundException('Target contact not found');

    return this.contactRepo.manager.transaction(async (manager) => {
      const interactionRepo = manager.getRepository(CrmInteraction);
      const noteRepo = manager.getRepository(CrmContactNote);
      const taskRepo = manager.getRepository(CrmTask);
      const automationRunRepo = manager.getRepository(CrmAutomationRun);
      const segmentMemberRepo = manager.getRepository(CrmSegmentMember);
      const recipientRepo = manager.getRepository(CrmCampaignRecipient);

      await interactionRepo.update({ contactId: sourceId }, { contactId: targetId });
      await noteRepo.update({ contactId: sourceId }, { contactId: targetId });
      await taskRepo.update({ contactId: sourceId }, { contactId: targetId });
      await automationRunRepo.update({ contactId: sourceId }, { contactId: targetId });

      const memberships = await segmentMemberRepo.find({ where: { contactId: sourceId } });
      if (memberships.length) {
        const existing = new Set(
          (await segmentMemberRepo.find({ where: { contactId: targetId } })).map(
            (m) => m.segmentId,
          ),
        );
        await segmentMemberRepo.delete({ contactId: sourceId });
        for (const membership of memberships) {
          if (!existing.has(membership.segmentId)) {
            await segmentMemberRepo.save(
              segmentMemberRepo.create({
                segmentId: membership.segmentId,
                contactId: targetId,
              }),
            );
          }
        }
      }

      const recipients = await recipientRepo.find({ where: { contactId: sourceId } });
      if (recipients.length) {
        const existing = new Set(
          (await recipientRepo.find({ where: { contactId: targetId } })).map(
            (r) => r.campaignId,
          ),
        );
        await recipientRepo.delete({ contactId: sourceId });
        for (const recipient of recipients) {
          if (!existing.has(recipient.campaignId)) {
            await recipientRepo.save(
              recipientRepo.create({
                campaignId: recipient.campaignId,
                contactId: targetId,
                status: recipient.status,
                email: recipient.email,
                phone: recipient.phone,
              }),
            );
          }
        }
      }

      target.tags = [...new Set([...(target.tags ?? []), ...(source.tags ?? [])])];
      target.interests = [...new Set([...(target.interests ?? []), ...(source.interests ?? [])])];
      target.totalBookings += source.totalBookings;
      target.lifetimeValueCop = Number(target.lifetimeValueCop) + Number(source.lifetimeValueCop);
      target.leadScore = Math.max(target.leadScore, source.leadScore);

      if (!target.firstBookingAt || (source.firstBookingAt && source.firstBookingAt < target.firstBookingAt)) {
        target.firstBookingAt = source.firstBookingAt;
      }
      if (source.lastBookingAt && (!target.lastBookingAt || source.lastBookingAt > target.lastBookingAt)) {
        target.lastBookingAt = source.lastBookingAt;
      }
      if (target.lifecycleStage === 'lead' && source.lifecycleStage !== 'lead') {
        target.lifecycleStage = source.lifecycleStage;
      }
      if (source.pipelineId && !target.pipelineId) target.pipelineId = source.pipelineId;
      if (source.stageId && !target.stageId) target.stageId = source.stageId;
      for (const field of ['firstName', 'lastName', 'phone', 'country', 'company', 'jobTitle', 'timezone', 'pronouns', 'birthDate', 'notes'] as const) {
        if (source[field] && !target[field]) target[field] = source[field];
      }
      if (source.userId && !target.userId) target.userId = source.userId;

      const merged = await manager.save(target);
      await manager.delete(CrmContact, { id: sourceId });

      return merged;
    });
  }

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  async getDashboard() {
    const byLifecycle = await this.contactRepo
      .createQueryBuilder('c')
      .select('c.lifecycleStage', 'stage')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.lifecycleStage')
      .getRawMany();

    const byLeadSource = await this.contactRepo
      .createQueryBuilder('c')
      .select('c.leadSource', 'source')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.leadSource')
      .getRawMany();

    const openTasks = await this.taskRepo.count({ where: { status: 'open' } });

    const pipelines = await this.pipelineRepo.find({
      where: { isActive: true },
      order: { position: 'ASC' },
    });
    const stages = await this.stageRepo.find();
    const stageCounts = await this.contactRepo
      .createQueryBuilder('c')
      .select('c.stageId', 'stageId')
      .addSelect('COUNT(*)', 'count')
      .where('c.stageId IS NOT NULL')
      .groupBy('c.stageId')
      .getRawMany();
    const stageCountMap = new Map(stageCounts.map((r) => [r.stageId, Number(r.count)]));

    const bookingStats = await this.bookingRepo
      .createQueryBuilder('b')
      .select('b.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(b.totalCop), 0)', 'sum')
      .groupBy('b.status')
      .getRawMany();

    const lifecycleMap = new Map(byLifecycle.map((r) => [r.stage, Number(r.count)]));
    const sourceMap = new Map(byLeadSource.map((r) => [r.source, Number(r.count)]));

    return {
      totalContacts: await this.contactRepo.count(),
      customers:
        (lifecycleMap.get('customer') ?? 0) + (lifecycleMap.get('repeat_customer') ?? 0),
      byLifecycle: Array.from(lifecycleMap.entries()).map(([stage, count]) => ({ stage, count })),
      byLeadSource: Array.from(sourceMap.entries()).map(([source, count]) => ({ source, count })),
      optIns: {
        email: await this.contactRepo.count({ where: { emailOptIn: true } }),
        whatsapp: await this.contactRepo.count({ where: { whatsappOptIn: true } }),
        sms: await this.contactRepo.count({ where: { smsOptIn: true } }),
      },
      openTasks,
      activeAutomations: await this.contactRepo.manager
        .getRepository(CrmAutomation)
        .count({ where: { status: 'active' } }),
      pipelines: pipelines.map((pipeline) => ({
        id: pipeline.id,
        name: pipeline.name,
        stages: stages
          .filter((stage) => stage.pipelineId === pipeline.id)
          .sort((a, b) => a.position - b.position)
          .map((stage) => ({
            id: stage.id,
            name: stage.name,
            count: stageCountMap.get(stage.id) ?? 0,
          })),
      })),
      bookings: bookingStats.map((row) => ({
        status: row.status,
        count: Number(row.count),
        revenueCop: Number(row.sum),
      })),
    };
  }

  private async computeLeadScore(contact: CrmContact): Promise<number> {
    const sourceWeight = this.sourceWeight(contact.leadSource);
    const bookingsWeight = Number(contact.totalBookings) * 15;
    const interactionCount = await this.interactionRepo.count({
      where: { contactId: contact.id },
    });
    const engagementWeight = Math.min(interactionCount * 2, 20);
    return Math.min(sourceWeight + bookingsWeight + engagementWeight, 100);
  }
}