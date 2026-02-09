# BadgerDispatch

## Overview

BadgerDispatch is a full-stack TypeScript application designed for field service operators (e.g., truck operators) to manage scheduling and dispatch. It offers a drag-and-drop scheduling board, operator and customer management, job tracking with visual status indicators, and a map view for job locations. The system aims to streamline operations, enhance communication, and improve efficiency for field service businesses.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with React and TypeScript, bundled by Vite. It uses Wouter for routing and TanStack React Query for server state management. UI components are built using shadcn/ui (new-york style) on Radix UI primitives with Tailwind CSS. Drag-and-drop functionality for the scheduling board is provided by @dnd-kit. Leaflet is used for map visualization, while Google Maps Places API provides address autocomplete. Forms are managed with react-hook-form and Zod validation. Path aliases (`@/` and `@shared/`) are used for organized imports.

### Backend
The backend utilizes Node.js with Express and TypeScript, exposing a RESTful JSON API under `/api/`. API route definitions and Zod schemas are shared between client and server for type safety. A custom build script uses Vite for the frontend and esbuild for the server.

### Data Storage
PostgreSQL is the primary database, managed by Drizzle ORM. The schema is defined in `shared/schema.ts` and uses a schema push approach for migrations. Key tables include `users`, `operators`, `customers`, `jobs`, `operator_qualifications`, `operator_documents`, and `sessions`.

### Authentication & Authorization
Authentication is handled via Replit OpenID Connect (OIDC) using `express-session` and `passport` with `openid-client`. User sessions are stored in PostgreSQL. Frontend routes are protected using a `ProtectedRoute` wrapper, and backend routes use `isAuthenticated` middleware.

### Shared Code
A `shared/` directory contains `schema.ts` for Drizzle table definitions and Zod insert schemas, and `routes.ts` for API route path definitions with Zod input/output schemas, ensuring consistency between frontend and backend.

### Key Design Decisions
The architecture prioritizes shared route contracts using Zod schemas for client-server synchronization, Drizzle ORM for lightweight data access, and shadcn/ui components for full customization. A monorepo-style layout is adopted without complex workspace tooling. Extensive CSS variables enable theming, including a critical color-coded job status system (e.g., `dispatched`, `unavailable`, `ready`).

### Core Features
- **Job Status System**: Critical color-coded status system for visual hierarchy of jobs.
- **Mobile View**: Responsive design includes a simplified mobile calendar view for screens under 768px, featuring week navigation, day headers, a capacity chart, and a compact schedule grid.
- **Operator Management**: Operators are sortable, with capacity calculations distinguishing truck operators from assistants. Map markers and truck location fields are managed based on operator type.
- **Dashboard Features (Desktop)**: Includes a weekly schedule board with drag-and-drop, a collapsible map panel with filtering and geocoding capabilities, same-location job indicators, and off-day scheduling protection. Right-click context menus are available on job cards and day cells for various actions. Supports different note types (`dispatch_note`, `day_note`) and qualification warning badges.
- **Analytics Dashboard**: Provides insights into unserviced demand, time off by week, OQ alerts, regional work distribution, cancelled jobs, and top customers with various filters and visualizations.
- **OQ Tracker Dashboard**: Manages operator qualification compliance with summary cards, a compliance matrix, alerts for expiring qualifications, and a filterable table for all records.
- **Operator Truck Locations**: Operators have specific fields for tracking their truck parking locations on the map.
- **Out-of-State Operator Availability**: Manages multi-day availability windows for out-of-state operators, affecting their scheduling and capacity.
- **Operator Time Off**: Stores and manages operator time-off periods, impacting schedule board visualization and capacity calculations.
- **Multi-Day Jobs**: Supports creating jobs that span multiple days, linked by a `seriesId`.

## External Dependencies

### Required Services
- **PostgreSQL Database**: Essential for all data persistence and session management.
- **Replit Auth (OIDC)**: Used for user authentication.

### Key npm Packages
- `drizzle-orm` + `drizzle-kit`
- `express` + `express-session`
- `connect-pg-simple`
- `passport` + `openid-client`
- `@tanstack/react-query`
- `@dnd-kit/core` + `@dnd-kit/sortable`
- `leaflet`
- `zod` + `drizzle-zod`
- `react-hook-form`
- `date-fns`
- `wouter`
- `@google-cloud/storage` + `@uppy/core` (for object storage file uploads)

### Operator Documents
Uses Replit App Storage (Object Storage) for uploading and managing operator-specific documents via presigned URLs.

### Searchable Group/Region Input
Utilizes a Popover/Command combobox for group/region selection in operator forms, suggesting existing groups and allowing new entries.