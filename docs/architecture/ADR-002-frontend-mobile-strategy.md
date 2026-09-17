# ADR-002: Frontend & Mobile Strategy

**Status:** Accepted  
**Date:** 2026-09-16

## Decision

- **Web app:** Vite + React 18 + TypeScript in `apps/web`, served as a PWA (offline-capable, installable, manifest + workbox service worker).
- **State:** zustand with `persist` middleware (tokens and session in `localStorage`).
- **Routing:** react-router-dom (nested layouts, mobile bottom-nav).
- **Maps:** Leaflet directly (imperative) with `leaflet/dist/leaflet.css`; map pins served by `/map/pins` with viewport bounds.
- **Native future:** the app is architected so it can be wrapped later with Capacitor (APK / iOS) without a rewrite.

## Rationale

- Mobile-first was chosen by the product owner: travelers book from their phones.
- PWA gives install-to-home-screen + offline shell now, while a native app is deferred.
- The API contract (`/api/v1`, JSON, Bearer tokens) is already web-friendly; native clients later reuse it as-is.

## Consequences

- **API base URL** is configurable via `VITE_API_BASE` (default `/api/v1` proxied by Vite in dev); a Capacitor build points it to the production URL without code changes.
- **Token storage** is isolated in `src/store/auth.ts`; Capacitor can swap `localStorage` for a secure native keychain store.
- Leaflet is used directly (no react-leaflet) so the map layer can be replaced by native map components later.
- Vite/Umd-like SSR concerns don't apply; `apps/web` is a pure SPA and must not assume server-side rendering.