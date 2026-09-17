import { api } from './client';
import type {
  AuthTokens,
  Booking,
  ConciergeChatInput,
  ConciergeChatResult,
  ContentQuery,
  CreateBookingInput,
  CrmContact,
  CrmInteraction,
  CrmLeadSource,
  CrmLifecycleStage,
  CrmLogInteractionInput,
  CrmUpsertInput,
  Event,
  Experience,
  ExperienceQuery,
  Guide,
  InitiatePaymentResult,
  MapPin,
  Paginated,
  Payment,
  Place,
  ReferralInfo,
  ReferralRedeemResult,
  Review,
  SessionState,
  User,
} from './types';

function qs<T extends object>(params: T): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const authApi = {
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    preferredLanguage?: string;
    preferredCurrency?: string;
  }) => api<AuthTokens>('/auth/register', { method: 'POST', body: input }),
  login: (input: { email: string; password: string }) =>
    api<AuthTokens>('/auth/login', { method: 'POST', body: input }),
  logout: () => api<{ message: string }>('/auth/logout', { method: 'POST', auth: 'access' }),
};

export const usersApi = {
  me: () => api<User>('/users/me', { auth: 'access' }),
  updateMe: (input: Partial<Pick<User, 'firstName' | 'lastName' | 'phone' | 'avatarUrl' | 'preferredLanguage' | 'preferredCurrency' | 'country'>>) =>
    api<User>('/users/me', { method: 'PATCH', body: input, auth: 'access' }),
};

export const experiencesApi = {
  list: (query: ExperienceQuery = {}) =>
    api<Paginated<Experience>>(`/experiences${qs(query)}`),
  detail: (id: string) => api<Experience>(`/experiences/${id}`),
};

export const bookingsApi = {
  create: (input: CreateBookingInput) =>
    api<Booking>('/bookings', { method: 'POST', body: input, auth: 'access' }),
  mine: () => api<Booking[]>('/bookings/mine', { auth: 'access' }),
  cancel: (id: string, reason: string) =>
    api<Booking>(`/bookings/${id}/cancel`, { method: 'PATCH', body: { reason }, auth: 'access' }),
};

export const paymentsApi = {
  initiate: (bookingId: string) =>
    api<InitiatePaymentResult>('/payments/initiate', { method: 'POST', body: { bookingId }, auth: 'access' }),
  confirm: (paymentId: string) =>
    api<Payment>(`/payments/${paymentId}/confirm`, { method: 'POST', auth: 'access' }),
  byBooking: (bookingId: string) =>
    api<Payment[]>(`/payments/booking/${bookingId}`, { auth: 'access' }),
};

export const contentApi = {
  places: (query: ContentQuery = {}) =>
    api<Paginated<Place>>(`/places${qs(query)}`),
  place: (id: string) => api<Place>(`/places/${id}`),
  events: (query: ContentQuery = {}) =>
    api<Paginated<Event>>(`/events${qs(query)}`),
  upcomingEvents: (days = 14) => api<Event[]>(`/events/upcoming${qs({ days })}`),
  eventDetail: (id: string) => api<Event>(`/events/${id}`),
  guides: (query: ContentQuery = {}) =>
    api<Paginated<Guide>>(`/guides${qs(query)}`),
  guideBySlug: (slug: string) => api<Guide>(`/guides/slug/${slug}`),
  mapPins: (bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
    includePlaces?: boolean;
    includeEvents?: boolean;
    includeExperiences?: boolean;
    category?: string;
    lgbtqFriendly?: boolean;
    lang?: 'es' | 'en';
  }) => api<MapPin[]>(`/map/pins${qs({ ...bounds })}`),
};

export const conciergeApi = {
  chat: (input: ConciergeChatInput) =>
    api<ConciergeChatResult>('/concierge/chat', { method: 'POST', body: input, auth: 'access' }),
  sessions: () => api<SessionState[]>('/concierge/sessions', { auth: 'access' }),
  session: (id: string) => api<SessionState>(`/concierge/sessions/${id}`, { auth: 'access' }),
  deleteSession: (id: string) =>
    api<{ deleted: boolean }>(`/concierge/sessions/${id}`, { method: 'DELETE', auth: 'access' }),
};

export const reviewsApi = {
  byExperience: (experienceId: string) =>
    api<Review[]>(`/reviews/experience/${experienceId}`),
  create: (input: {
    bookingId: string;
    rating: number;
    content: string;
    language: string;
    hostRating?: number;
    valueRating?: number;
    accuracyRating?: number;
    imageUrls?: string[];
  }) => api<Review>('/reviews', { method: 'POST', body: input, auth: 'access' }),
};

export const referralsApi = {
  me: () => api<ReferralInfo>('/referrals/me', { auth: 'access' }),
  create: () => api<ReferralInfo>('/referrals/me', { method: 'POST', auth: 'access' }),
  redeem: (code: string) =>
    api<ReferralRedeemResult>('/referrals/redeem', { method: 'POST', body: { code }, auth: 'access' }),
  share: (name?: string, language?: string) =>
    api<{ code: string; message: string }>(`/referrals/share${qs({ name, language })}`, {
      auth: 'access',
    }),
};

export const crmApi = {
  list: (query: {
    lifecycleStage?: CrmLifecycleStage;
    leadSource?: CrmLeadSource;
    tag?: string;
    page?: number;
    limit?: number;
  } = {}) => api<Paginated<CrmContact>>(`/crm/contacts${qs(query)}`, { auth: 'access' }),
  detail: (id: string) => api<CrmContact>(`/crm/contacts/${id}`, { auth: 'access' }),
  interactions: (id: string) => api<CrmInteraction[]>(`/crm/contacts/${id}/interactions`, { auth: 'access' }),
  create: (input: CrmUpsertInput) =>
    api<CrmContact>('/crm/contacts', { method: 'POST', body: input, auth: 'access' }),
  logInteraction: (input: CrmLogInteractionInput) =>
    api<CrmInteraction>('/crm/interactions', { method: 'POST', body: input, auth: 'access' }),
  updateLifecycle: (id: string, stage: CrmLifecycleStage) =>
    api<CrmContact>(`/crm/contacts/${id}/lifecycle`, { method: 'PATCH', body: { stage }, auth: 'access' }),
  addTags: (id: string, tags: string[]) =>
    api<CrmContact>(`/crm/contacts/${id}/tags`, { method: 'PATCH', body: { tags }, auth: 'access' }),
};