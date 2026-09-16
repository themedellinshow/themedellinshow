# The Medellín Show with Héctor

Tourism discovery and booking platform for Medellín.

## Quick Start

```bash
# Start infrastructure
cd infra/docker && docker-compose up -d

# Install dependencies
npm install

# Copy environment
cp .env.example .env

# Run API
npm run api:dev

# Run AI Gateway (separate terminal)
npm run ai-gateway:dev
```

## Architecture

- `apps/api` - Main REST API (NestJS)
- `apps/ai-gateway` - AI services with prompt caching
- `packages/shared-types` - Shared DTOs and interfaces
- `packages/shared-config` - Constants and configuration
