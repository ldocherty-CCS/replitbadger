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
- **Address Autocomplete**: Google Maps Places API for address input fields (operator truck location, job addresses). Reusable `AddressAutocomplete` component in `client/src/components/AddressAutocomplete.tsx`. API key served via `GET /api/config/maps-key`.
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
  - `operator_qualifications` — OQ tracking records linking operators to qualifications with issue/expiration dates, document info, status
  - `sessions` — PostgreSQL-backed session store (created by connect-pg-simple)

### Authentication & Authorization
- **Auth Provider**: Replit OpenID Connect (OIDC) authentication
- **Session Management**: express-session with connect-pg-simple storing sessions in PostgreSQL
- **Passport**: passport with openid-client Strategy for OIDC flow
- **User Upsert**: On login, users are upserted into the `users` table via `authStorage.upsertUser()`
- **Protected Routes**: Frontend uses a `ProtectedRoute` wrapper; backend uses `isAuthenticated` middleware
- **Login Flow**: Client redirects to `/api/login`, which initiates OIDC flow with Replit
- **Environment Variables Required**: `DATABASE_URL`, `SESSION_SECRET`, `REPL_ID`, `ISSUER_URL` (defaults to Replit OIDC), `GOOGLE_MAPS_API_KEY` (for address autocomplete)

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
- `dispatched` (green), `unavailable` (red), `ready` (blue), `ticket_created` (sky blue), `existing` (gray), `missing_info` (pink), `not_qualified` (orange), `cancelled` (gray), `standby` (purple)

### Mobile View
- **Responsive Detection**: Screens under 768px width automatically show simplified mobile calendar view
- **Week Navigation**: Previous/next week buttons with month/year label; tap month to jump to current week
- **Day Headers**: Single-letter day names (S M T W T F S) with day numbers; today highlighted with primary circle
- **Capacity Chart**: Per-day availability bars showing available/effective truck ratio (green=available, amber=full, red=overbooked)
- **Schedule Grid**: Compact operator-by-day grid with truncated operator names, status-colored job cells showing customer names
- **Off-Day Display**: Days off shown with red background and "OFF" label
- **Component**: `MobileCalendarView` in `client/src/components/MobileCalendarView.tsx`

### Operator Sorting & Capacity
- **Sorting**: Within each group, regular Operators appear before Assistant Operators, each sub-sorted by last name ascending
- **Capacity Chart**: Only counts truck operators (excludes assistants) for totalTrucks, booked, offCount, effectiveTrucks
- **Map Markers**: Assistant operators are excluded from truck parking markers on the map
- **Truck Location**: Assistant operators don't have a truck park location field in the operator form

### Dashboard Features (Desktop)
- **Schedule Board**: Weekly grid of operators x days with drag-and-drop job assignment
- **Collapsible Map Panel**: Embedded Leaflet map on the right side of dashboard showing:
  - **Date Filter**: Day-by-day navigation in map header (defaults to tomorrow). Only jobs for the selected date appear on the map.
  - Job locations as colored circle markers (color = job status)
  - Operator truck parking locations as square markers with truck icons (color = operator color)
- **Same-Location Indicator**: When multiple jobs share the same address on the same day, each job card shows a truck icon with "X/Y" (e.g., "1/3") position badge
- **Off-Day Scheduling Protection**: Dragging a job onto an operator who has the day off is blocked with a warning toast. The Create/Edit Job dialog also shows a red warning banner and prevents submission.
- **Right-Click Context Menu** on job cards:
  - Duplicate Job
  - Change Status (submenu with status options, excluding cancelled/standby)
  - Cancel Job (moves to cancelled bucket)
  - Restore Job (on cancelled jobs, restores to Ready status)
  - Delete Job
- **Cancelled Jobs Bucket**: Collapsible row at bottom of schedule board showing cancelled jobs per day with truck count badges. Expand to see/restore individual cancelled jobs.
- **2nd Jobs / Standby**: Collapsible row for potential backup jobs (status="standby"). When an operator finishes early, standby jobs can be moved to the main board via status change or drag-and-drop.

### OQ Tracker Dashboard
- **Summary Cards**: Active OQs, Expiring Soon (30-day window), Expired, Not on File counts
- **Compliance Matrix**: Operator x Qualification grid showing status icons (green check = active, amber clock = expiring, red X = expired, dash = missing). Click any cell to add/edit. Progress bar per operator.
- **Alerts Tab**: Sorted list of expired and expiring qualifications with urgency indicators
- **All Records Tab**: Filterable/searchable table with edit/delete capabilities
- **Add/Edit Dialog**: Create or update OQ records with operator, qualification, dates, document info, and notes

### Operator Truck Locations
Operators have `truckLat` and `truckLng` fields for mapping their truck parking location on the dashboard map.

### Out-of-State Operator Availability
- Out-of-state operators (`isOutOfState=true`) use the `operator_availability` table for tracking multiple visit windows
- Each availability window has `startDate`, `endDate`, `notes`, and `operatorId` fields
- Days outside any active availability window are treated as OFF on the schedule board (red background, "OFF" label, truck not counted in availability)
- Operator cards show a "Manage" button for out-of-state operators to open the availability management dialog
- AvailabilityDialog allows adding, editing, and deleting availability windows with color-coded status (active=green, upcoming=blue, past=dimmed)
- Legacy `availableFrom`/`availableTo` fields on operators are still supported as fallback when no availability records exist
- API: `GET /api/operator-availability?operatorId=X`, `POST /api/operator-availability`, `PUT /api/operator-availability/:id`, `DELETE /api/operator-availability/:id`
- Hook: `useOperatorAvailability(operatorId)` for per-operator, `useAllOperatorAvailability()` for all records
- Removing an off-day for an out-of-state operator on the schedule board creates or extends an availability window

### Operator Time Off
- `operator_time_off` table stores date ranges (startDate, endDate) with operator reference and optional reason
- Time Off button in dashboard header opens management dialog
- Days marked as time-off show red background with "OFF" label on schedule board
- AvailabilityChart shows effective truck count (total trucks minus operators off/unavailable)
- Multi-day records can be expanded to show individual days with remove buttons
- Removing a day from the middle of a range splits it into two records (POST /api/time-off/:id/remove-day)
- Removing a day from start/end trims the range accordingly

### Multi-Day Jobs
- Jobs can be created spanning multiple days via "Multi-day job" checkbox in CreateJobDialog
- Creates separate job records per day linked by `seriesId` field (format: `series-{timestamp}-{random}`)
- Uses dedicated `/api/jobs/series` endpoint for batch creation

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