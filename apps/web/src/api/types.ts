export type Language = 'es' | 'en' | 'pt';
export type UserRole = 'traveler' | 'host' | 'companion' | 'partner' | 'admin';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  preferredLanguage: Language;
  preferredCurrency: 'COP' | 'USD';
  country: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type ExperienceStatus = 'draft' | 'pending_review' | 'active' | 'paused' | 'archived';

export interface Experience {
  id: string;
  titleEs: string;
  titleEn: string;
  titlePt?: string | null;
  descriptionEs: string;
  descriptionEn: string;
  descriptionPt?: string | null;
  category: string;
  tags: string[];
  priceCop: string;
  priceUsd?: string | null;
  durationMinutes: number;
  minParticipants: number;
  maxParticipants: number;
  neighborhood: string;
  meetingPointEs?: string | null;
  meetingPointEn?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  imageUrls: string[];
  videoUrl?: string | null;
  lgbtqFriendly: boolean;
  accessibleFriendly: boolean;
  familyFriendly: boolean;
  featured: boolean;
  status: ExperienceStatus;
  averageRating: string | null;
  totalReviews: number;
  totalBookings: number;
  hostId: string;
  createdAt: string;
  updatedAt: string;
  host?: User;
}

export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: Meta;
}

export interface ExperienceQuery {
  category?: string;
  neighborhood?: string;
  minPrice?: number;
  maxPrice?: number;
  participants?: number;
  lgbtqFriendly?: boolean;
  featured?: boolean;
  search?: string;
  lang?: Language;
  page?: number;
  limit?: number;
  sortBy?: 'price' | 'rating' | 'created' | 'popular';
  sortOrder?: 'asc' | 'desc';
}

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'paid'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'no_show';

export interface Booking {
  id: string;
  bookingReference: string;
  travelerId: string;
  experienceId: string;
  hostId: string;
  bookingDate: string;
  startTime: string;
  participants: number;
  subtotalCop: string;
  serviceFee: string;
  totalCop: string;
  currencyPaid: 'COP' | 'USD';
  totalPaidUsd: string | null;
  status: BookingStatus;
  specialRequests?: string | null;
  contactEmail: string;
  contactPhone?: string | null;
  confirmedAt?: string | null;
  paidAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  experience?: Experience;
  traveler?: User;
}

export interface CreateBookingInput {
  experienceId: string;
  bookingDate: string;
  startTime: string;
  participants: number;
  specialRequests?: string;
  contactEmail: string;
  contactPhone?: string;
}

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export interface Payment {
  id: string;
  bookingId: string;
  userId: string;
  amount: string;
  currency: 'COP' | 'USD';
  provider: 'stripe' | 'mercadopago' | 'manual';
  providerPaymentId: string;
  providerCustomerId?: string | null;
  status: PaymentStatus;
  failureReason?: string | null;
  refundedAmount: string;
  refundReason?: string | null;
  refundedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  booking?: Booking;
}

export interface InitiatePaymentResult {
  payment: Payment;
  clientSecret?: string;
}

export type PlaceCategory =
  | 'restaurant'
  | 'bar'
  | 'club'
  | 'cafe'
  | 'museum'
  | 'park'
  | 'attraction'
  | 'hotel'
  | 'spa'
  | 'shopping';

export interface Place {
  id: string;
  nameEs: string;
  nameEn: string;
  descriptionEs: string;
  descriptionEn: string;
  category: PlaceCategory;
  tags: string[];
  neighborhood: string;
  address: string;
  latitude: string;
  longitude: string;
  phone?: string | null;
  website?: string | null;
  instagramHandle?: string | null;
  operatingHours: Record<string, { open: string; close: string }>;
  priceRange: number;
  imageUrls: string[];
  lgbtqFriendly: boolean;
  featured: boolean;
  isActive: boolean;
  averageRating: string | null;
  totalReviews: number;
  createdAt: string;
  updatedAt: string;
}

export type EventCategory =
  | 'concert'
  | 'festival'
  | 'nightlife'
  | 'cultural'
  | 'gastronomic'
  | 'sports'
  | 'lgbtq'
  | 'community'
  | 'other';

export interface Event {
  id: string;
  titleEs: string;
  titleEn: string;
  titlePt?: string | null;
  descriptionEs: string;
  descriptionEn: string;
  descriptionPt?: string | null;
  category: EventCategory;
  tags: string[];
  startsAt: string;
  endsAt: string;
  timezone: string;
  placeId?: string | null;
  place?: Place;
  venueName?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  ticketed: boolean;
  ticketUrl?: string | null;
  minPriceCop?: string | null;
  maxPriceCop?: string | null;
  coverImageUrl?: string | null;
  imageUrls: string[];
  lgbtqFriendly: boolean;
  familyFriendly: boolean;
  featured: boolean;
  status: 'draft' | 'published' | 'cancelled' | 'past';
  source?: string | null;
  sourceUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentQuery {
  category?: string;
  neighborhood?: string;
  featured?: boolean;
  lgbtqFriendly?: boolean;
  search?: string;
  lang?: Language;
  page?: number;
  limit?: number;
}

export interface Guide {
  id: string;
  slug: string;
  category: string;
  titleEs: string;
  titleEn: string;
  titlePt?: string | null;
  summaryEs: string;
  summaryEn: string;
  summaryPt?: string | null;
  content: Record<Language, GuideSection[]>;
  relatedPlaceIds: string[];
  relatedExperienceIds: string[];
  tags: string[];
  coverImageUrl?: string | null;
  featured: boolean;
  status: 'draft' | 'published' | 'archived';
  authorName?: string | null;
  publishedAt?: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GuideSection {
  type: 'heading' | 'paragraph' | 'list' | 'place-ref' | 'experience-ref';
  title?: string;
  content: string;
  items?: string[];
  refIds?: string[];
}

export type MapPinType = 'place' | 'event' | 'experience';

export interface MapPin {
  id: string;
  type: MapPinType;
  title: string;
  latitude: number;
  longitude: number;
  category?: string | null;
  neighborhood?: string | null;
  imageUrl?: string | null;
  lgbtqFriendly?: boolean;
  extra?: {
    priceRange?: number;
    averageRating?: number;
    startsAt?: string;
    endsAt?: string;
    minPriceCop?: string;
    priceCop?: string;
  };
}

export interface ConciergeChatInput {
  sessionId?: string;
  message: string;
  language: Language;
  context?: {
    interests?: string[];
    currentLocation?: string;
    lgbtqFriendly?: boolean;
  };
}

export interface ConciergeChatResult {
  sessionId: string;
  response: string;
  cacheHit?: boolean;
}

export interface ConciergeTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SessionState {
  sessionId: string;
  userId: string;
  language: Language;
  createdAt: number;
  updatedAt: number;
  turns: ConciergeTurn[];
  context?: {
    interests?: string[];
    currentLocation?: string;
    lgbtqFriendly?: boolean;
  };
}

export interface Review {
  id: string;
  bookingId: string;
  reviewerId: string;
  experienceId: string;
  rating: number;
  content: string;
  language: Language;
  hostRating?: number | null;
  valueRating?: number | null;
  accuracyRating?: number | null;
  imageUrls: string[];
  status: 'approved' | 'pending_moderation' | 'rejected' | 'hidden';
  verified: boolean;
  helpfulCount: number;
  moderationNote?: string | null;
  createdAt: string;
  updatedAt: string;
  reviewer?: User;
  experience?: Experience;
}

export interface ReferralInfo {
  hasProgram: boolean;
  code?: string | null;
  status?: 'active' | 'banned' | 'expired';
  rewardType?: 'credit' | 'cash';
  rewardAmountCop?: string;
  referrerRewardCop?: string;
  totalReferred?: number;
  totalRewarded?: number;
  totalRewardsCop?: string;
  redemptions?: {
    id: string;
    referredUserId: string;
    status: string;
    qualifyingBookingId: string | null;
    createdAt: string;
  }[];
}

export interface ReferralRedeemResult {
  id: string;
  status: string;
  message: string;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}

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

export interface CrmContact {
  id: string;
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
  firstBookingAt?: string | null;
  lastBookingAt?: string | null;
  lastContactedAt?: string | null;
  emailOptIn: boolean;
  whatsappOptIn: boolean;
  smsOptIn: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
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

export type CrmInteractionChannel = 'email' | 'whatsapp' | 'sms' | 'app' | 'concierge' | 'manual';

export interface CrmInteraction {
  id: string;
  contactId: string;
  type: CrmInteractionType;
  channel: CrmInteractionChannel;
  subject?: string | null;
  content?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface CrmUpsertInput {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  leadSource?: CrmLeadSource;
  tags?: string[];
  emailOptIn?: boolean;
  whatsappOptIn?: boolean;
  smsOptIn?: boolean;
}

export interface CrmLogInteractionInput {
  contactId?: string;
  email?: string;
  type: CrmInteractionType;
  channel: CrmInteractionChannel;
  subject?: string;
  content?: string;
}