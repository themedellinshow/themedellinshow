// Supported languages
export const LANGUAGES = ['es', 'en', 'pt'] as const;
export const DEFAULT_LANGUAGE = 'es';

// Supported currencies
export const CURRENCIES = ['COP', 'USD'] as const;
export const DEFAULT_CURRENCY = 'COP';

// User roles hierarchy (lower index = higher privilege)
export const USER_ROLES = ['admin', 'partner', 'host', 'companion', 'traveler'] as const;

// Experience categories
export const EXPERIENCE_CATEGORIES = [
  'cultural',
  'gastronomic',
  'nightlife',
  'adventure',
  'wellness',
  'lgbtq',
  'local-life',
] as const;

// Booking statuses
export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'paid',
  'completed',
  'cancelled',
  'refunded',
] as const;

// Review settings
export const REVIEW_MIN_LENGTH = 20;
export const REVIEW_MAX_LENGTH = 2000;
export const REVIEW_MIN_RATING = 1;
export const REVIEW_MAX_RATING = 5;
