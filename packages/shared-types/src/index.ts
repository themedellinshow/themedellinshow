// User roles - defined from day 1
export type UserRole = 'traveler' | 'host' | 'companion' | 'partner' | 'admin';

// Supported languages
export type Language = 'es' | 'en' | 'pt';

// Supported currencies
export type Currency = 'COP' | 'USD';

// Common API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// Pagination query params
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Base entity fields (all entities will have these)
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// --- CRM ---
export type CrmLeadSource =
  | 'organic'
  | 'referral'
  | 'social'
  | 'ads'
  | 'concierge'
  | 'partner'
  | 'other';

export type CrmLifecycleStage =
  | 'lead'
  | 'prospect'
  | 'customer'
  | 'repeat_customer'
  | 'inactive';

export interface CrmContact extends BaseEntity {
  userId?: string | null;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  country?: string | null;
  leadSource: CrmLeadSource;
  lifecycleStage: CrmLifecycleStage;
  interests?: string[] | null;
  tags?: string[] | null;
  totalBookings: number;
  lifetimeValueCop: string;
  firstBookingAt?: Date | null;
  lastBookingAt?: Date | null;
  lastContactedAt?: Date | null;
  emailOptIn: boolean;
  whatsappOptIn: boolean;
  smsOptIn: boolean;
  notes?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  timezone?: string | null;
  pronouns?: string | null;
  birthDate?: string | null;
  doNotContact: boolean;
  unsubscribedAt?: Date | null;
  lastEmailOpenAt?: Date | null;
  lastWhatsappReplyAt?: Date | null;
  leadScore: number;
}

export type CrmInteractionType =
  | 'email_sent'
  | 'email_opened'
  | 'whatsapp_sent'
  | 'whatsapp_replied'
  | 'concierge_chat'
  | 'booking_created'
  | 'booking_completed'
  | 'review_submitted'
  | 'note';

export type CrmInteractionChannel =
  | 'email'
  | 'whatsapp'
  | 'sms'
  | 'app'
  | 'concierge'
  | 'manual';

export interface CrmInteraction {
  id: string;
  contactId: string;
  type: CrmInteractionType;
  channel: CrmInteractionChannel;
  subject?: string | null;
  content?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

export interface CrmUpsertInput {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  leadSource?: CrmLeadSource;
  interests?: string[];
  tags?: string[];
  emailOptIn?: boolean;
  whatsappOptIn?: boolean;
  smsOptIn?: boolean;
  company?: string;
  jobTitle?: string;
  timezone?: string;
  pronouns?: string;
  birthDate?: string;
  notes?: string;
}

export interface CrmLogInteractionInput {
  contactId?: string;
  email?: string;
  type: CrmInteractionType;
  channel: CrmInteractionChannel;
  subject?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface CrmUpdateContactInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  company?: string;
  jobTitle?: string;
  timezone?: string;
  pronouns?: string;
  birthDate?: string;
  notes?: string;
  interests?: string[];
  tags?: string[];
  leadSource?: CrmLeadSource;
  lifecycleStage?: CrmLifecycleStage;
  doNotContact?: boolean;
}

export interface CrmConsentsInput {
  emailOptIn?: boolean;
  whatsappOptIn?: boolean;
  smsOptIn?: boolean;
  doNotContact?: boolean;
}
