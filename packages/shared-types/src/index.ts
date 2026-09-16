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
