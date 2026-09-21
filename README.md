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
- `apps/web` - PWA mobile-first (traveler app + admin/CRM)
- `packages/shared-types` - Shared DTOs and interfaces
- `packages/shared-config` - Constants and configuration

## Prompt Maestro (referencia del proyecto)

> El siguiente es el "prompt maestro" original con la estructura de proyecto, la
> visión de negocio y el orden de construcción. Se copia aquí como referencia
> normativa para OpenCode.

### 1. Estructura de proyecto (monorepo)

```
medellin-show/
├── apps/
│   ├── api/                        # API principal (NestJS)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── users/
│   │   │   │   ├── experiences/
│   │   │   │   ├── bookings/
│   │   │   │   ├── payments/
│   │   │   │   ├── reviews/
│   │   │   │   ├── content/         # places, guide, map, events
│   │   │   │   ├── news/            # motor de noticias
│   │   │   │   ├── concierge/       # Build My Medellín, itinerarios
│   │   │   │   ├── marketplace/     # companions, hosts, partners
│   │   │   │   ├── notifications/   # WhatsApp, email
│   │   │   │   └── crm/
│   │   │   ├── common/              # filtros, pipes, guards, decoradores
│   │   │   ├── config/              # env, i18n, monedas
│   │   │   └── main.ts
│   │   ├── test/
│   │   └── package.json
│   │
│   ├── ai-gateway/                  # Servicio dedicado a IA (prompt caching aquí)
│   │   ├── src/
│   │   │   ├── prompts/             # system prompts versionados por caso de uso
│   │   │   ├── cache/               # capa de prompt caching
│   │   │   ├── news-filter/
│   │   │   ├── concierge-engine/
│   │   │   └── moderation/
│   │   └── package.json
│   │
│   └── web/                         # (NO se construye hasta cerrar Fases 0-4 de backend)
│
├── packages/
│   ├── shared-types/                # DTOs e interfaces compartidas API/web
│   ├── shared-config/               # constantes: idiomas, monedas, roles
│   └── ui-tokens/                   # design tokens mobile-first (para cuando exista frontend)
│
├── infra/
│   ├── docker/
│   ├── ci-cd/
│   └── db/
│       └── migrations/
│
├── docs/
│   └── architecture/                # este documento y decisiones técnicas (ADR)
│
└── README.md
```

**Principios de esta estructura:**

- Cada módulo de `api/` es un dominio autocontenible (controlador, servicio, entidad, DTOs, tests) — así se puede extraer a microservicio después sin romper nada.
- `ai-gateway` está separado del API core a propósito: todo el prompt caching, versionado de prompts y control de costo de IA vive en un solo lugar.
- `apps/web` existe como carpeta reservada pero no se debe generar código dentro de ella hasta que el backend de las Fases 0-4 esté cerrado y probado.
- `packages/ui-tokens` se crea desde ya (vacío) para que cuando llegue el frontend, el enfoque mobile-first tenga sus fundamentos de diseño listos.

### 2. Prompt maestro (para pegar en OpenCode)

> Actúa como arquitecto de software y desarrollador senior full-stack. Vas a
> construir "The Medellín Show with Héctor", una plataforma de descubrimiento
> y reserva de experiencias turísticas en Medellín (cultura, gastronomía,
> vida nocturna, LGBTQ+, concierge personal, marketplace de anfitriones y
> companions).

**CONTEXTO DE NEGOCIO (resumen mínimo necesario, no releer documentos fuente):**

- Idiomas: español, inglés, portugués. Monedas: COP y USD.
- Público: viajeros internacionales, LGBTQ+, solos, parejas y grupos.
- Núcleo funcional: experiencias reservables, booking, pagos, reseñas verificadas, motor de noticias con filtro de IA, concierge de viaje con IA, marketplace de anfitriones/companions, CRM y automatización.
- Principio de servicio en companions: "presencia, no intimidad transaccional" — reflejarlo en el modelo de datos y en cualquier copy.

**RESTRICCIÓN CRÍTICA DE AUDIENCIA:**

> El 90% de los usuarios finales navegan desde dispositivos móviles. Todo lo
> que se construya de cara al usuario (cuando llegue esa fase) debe diseñarse
> mobile-first: layouts, formularios, navegación, imágenes y tiempos de carga
> deben optimizarse primero para pantallas pequeñas y conexiones móviles
> variables, y solo después adaptarse a tablet/desktop. Esto no es una fase de
> "responsive al final": cada componente de UI que se construya debe nacer
> mobile-first.

**ORDEN DE CONSTRUCCIÓN (NO NEGOCIABLE):**

> No generes ningún código de frontend (`apps/web`) hasta que yo confirme
> explícitamente que las Fases 0 a 4 de backend (fundaciones técnicas, base
> de datos, API núcleo, booking/pagos/reviews, integraciones y automatización)
> están completas y probadas. Si en algún momento parece lógico "adelantar"
> una pantalla o componente visual, detente y pregúntame primero.

**STACK TÉCNICO OBLIGATORIO:**

- API: Node.js con NestJS, arquitectura modular por dominio.
- Base de datos: PostgreSQL como fuente de verdad transaccional.
- Caché y sesiones: Redis.
- Cola de mensajes para eventos asíncronos (bookings, pagos, notificaciones, motor de noticias) — no acoplar estos procesos a las respuestas HTTP.
- Servicio separado `ai-gateway` para toda llamada a modelos de lenguaje (filtro de noticias, moderación, concierge). Ninguna llamada a un LLM debe hacerse directamente desde `api/`.
- API versionada desde el inicio: todos los endpoints bajo `/api/v1/`.
- Autenticación JWT + refresh tokens, con roles desde el día 1: traveler, host, companion, partner, admin.

**PROMPT CACHING EN EL AI-GATEWAY (OBLIGATORIO):**

> En `apps/ai-gateway`, cada caso de uso de IA debe separar explícitamente:
> 1. Bloque ESTABLE (system prompt, reglas de moderación, tono de marca de Héctor, catálogo resumido de experiencias) → márcalo para prompt caching, reutilizable entre llamadas.
> 2. Bloque VARIABLE (input del usuario, noticia a clasificar, preferencias del viajero) → nunca se cachea.
> Aplica esto como mínimo en: motor de noticias (clasificación/moderación) y motor de concierge (generación de itinerarios). Documenta en `apps/ai-gateway/src/prompts/` cada prompt versionado (no lo reescribas sobre la marcha sin versionar).

**EFICIENCIA DE CONTEXTO (OBLIGATORIO PARA EL AGENTE):**

> No releas documentos completos del proyecto en cada tarea. Trabaja fase por
> fase con el contexto mínimo necesario... Pide solo los fragmentos de contexto
> que la tarea actual requiera.

**ESCALABILIDAD:**

- Cada módulo del API debe poder convertirse en microservicio sin reescritura mayor (bajo acoplamiento, contratos claros vía DTOs compartidos en `packages/shared-types`).
- Toda integración externa (pagos, WhatsApp, email) debe implementarse detrás de una interfaz (ej. `PaymentProvider`, `MessagingProvider`).
- Los procesos pesados o no urgentes (notificaciones, procesamiento de noticias) van por cola, nunca de forma síncrona en el request HTTP.

**FORMA DE TRABAJO ESPERADA:**

1. Trabaja una fase a la vez, en el orden: Fase 0 (fundaciones) → Fase 1 (modelado de base de datos) → Fase 2 (auth + experiencias) → Fase 3 (booking + pagos + reviews) → Fase 4 (integraciones y automatización). Las fases de contenido/IA (5-6) y marketplace/ecosistema (7-8) vienen después, y el frontend solo al final de todo.
2. Al terminar cada fase, entrega un resumen breve de lo construido, los endpoints o migraciones creadas, y espera confirmación antes de seguir.
3. Escribe tests de integración para cada módulo antes de darlo por cerrado.
4. Si una decisión de arquitectura no está clara en este prompt, pregunta en vez de asumir.

**Empieza por la Fase 0:** fundaciones técnicas (estructura de carpetas, configuración de entornos, CI/CD básico, esqueleto de `ai-gateway` con soporte de prompt caching). No avances a la Fase 1 sin confirmación.
