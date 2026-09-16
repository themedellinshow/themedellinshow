# ADR-001: Technology Stack

**Status:** Accepted  
**Date:** 2024-01-01

## Decision

- **API Framework:** NestJS with modular architecture
- **Database:** PostgreSQL (transactional source of truth)
- **Cache/Sessions:** Redis
- **Queue:** Bull (Redis-backed)
- **AI Services:** Separate ai-gateway service with prompt caching

## Rationale

- NestJS provides TypeScript-first, modular architecture ready for microservices
- PostgreSQL handles complex relational data (bookings, users, experiences)
- Redis provides fast caching and session management
- Bull enables async processing without blocking HTTP requests
- Separated ai-gateway isolates LLM costs and allows independent scaling

## Consequences

- Each module can become a microservice without major rewrite
- All LLM calls go through ai-gateway (no direct calls from api/)
- Heavy processes (notifications, news processing) use queues
