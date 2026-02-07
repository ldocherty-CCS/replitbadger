# BadgerDispatch

## Overview

BadgerDispatch is a scheduling and dispatch management system for field service operators (e.g., truck operators). It provides a drag-and-drop scheduling board, operator/customer management, job tracking with status-based visual indicators, and a map view for job locations. The application is built as a full-stack TypeScript project with a React frontend and Express backend, using PostgreSQL for data storage.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: TanStack React Query for server state; no dedicated client state library
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS
- **Drag and Drop**: @dnd-kit/core and @dnd-kit/sortable for the scheduling board's drag-and-drop job assignment
- **Map**: Leaflet (not Google Maps) for the map view, centered on Milwaukee, WI
- **Forms**: react-hook-form with zod validation via @hookform/resolvers
- **Date Handling**: date-fns
- **Icons**: lucide-react
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript, executed via tsx in development
- **HTTP Server**: Node's native `http.createServer` wrapping Express (supports WebSocket upgrades if needed)
- **API Pattern**: RESTful JSON API under `/api/` prefix. Route definitions with Zod schemas are shared between client and server in `shared/routes.ts`
- **Build**: Custom build script using Vite for frontend and esbuild for server, outputting to `dist/`

### Data Storage
- **Database**: PostgreSQL (required, via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-orm/node-postgres` driver
- **Schema**: Defined in `shared/schema.ts` using Drizzle's `pgTable` definitions
- **Migrations**: Managed via `drizzle-kit push` (schema push approach, not migration files)
- **Core Tables**:
  - `users` — Supports Replit Auth (varchar ID, optional username/password, profile fields, role)
  - `operators` — Field operators with name, group, qualifications array, color, truck location
  - `customers` — Clients with contact info and required qualifications
  - `jobs` — Scheduled jobs linking customers and operators, with status, dates, times, addresses
  - `sessions` — PostgreSQL-backed session store (created by connect-pg-simple)

### Authentication & Authorization
- **Auth Provider**: Replit OpenID Connect (OIDC) authentication
- **Session Management**: express-session with connect-pg-simple storing sessions in PostgreSQL
- **Passport**: passport with openid-client Strategy for OIDC flow
- **User Upsert**: On login, users are upserted into the `users` table via `authStorage.upsertUser()`
- **Protected Routes**: Frontend uses a `ProtectedRoute` wrapper; backend uses `isAuthenticated` middleware
- **Login Flow**: Client redirects to `/api/login`, which initiates OIDC flow with Replit
- **Environment Variables Required**: `DATABASE_URL`, `SESSION_SECRET`, `REPL_ID`, `ISSUER_URL` (defaults to Replit OIDC)

### Shared Code (`shared/` directory)
- `schema.ts` — Drizzle table definitions and Zod insert schemas (shared between client and server)
- `routes.ts` — API route path definitions with Zod input/output schemas, used by both frontend hooks and backend route handlers for type safety

### Key Design Decisions
1. **Shared route contracts**: API routes are defined once in `shared/routes.ts` with Zod schemas, ensuring client and server stay in sync without code generation
2. **Drizzle over Prisma**: Chosen for lighter weight, SQL-close abstractions, and shared schema with Zod via `drizzle-zod`
3. **shadcn/ui components**: Copy-pasted into `client/src/components/ui/` for full customization control rather than importing from a package
4. **Custom CSS variables**: Extensive theming system with CSS variables for colors including job status colors (dispatched, unavailable, ready, ticket_created, etc.)
5. **Monorepo-style layout**: Single package.json with client/, server/, and shared/ directories; no workspace tooling needed

### Job Status System
Jobs use a color-coded status system critical for visual hierarchy:
- `dispatched` (green), `unavailable` (red), `ready` (blue), `ticket_created` (sky blue), `existing` (gray), `missing_info` (pink), `not_qualified` (orange)

## External Dependencies

### Required Services
- **PostgreSQL Database**: Required for all data storage and session management. Must be provisioned and `DATABASE_URL` set
- **Replit Auth (OIDC)**: Authentication via Replit's OpenID Connect provider. Requires `REPL_ID` and `SESSION_SECRET` environment variables

### Key npm Packages
- `drizzle-orm` + `drizzle-kit` — Database ORM and migration tooling
- `express` + `express-session` — HTTP server and session middleware
- `connect-pg-simple` — PostgreSQL session store
- `passport` + `openid-client` — Authentication
- `@tanstack/react-query` — Server state management
- `@dnd-kit/core` + `@dnd-kit/sortable` — Drag and drop
- `leaflet` — Map rendering
- `zod` + `drizzle-zod` — Schema validation
- `react-hook-form` — Form handling
- `date-fns` — Date utilities
- `wouter` — Client-side routing