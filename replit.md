# InNews ROMS — Release Order Management System

A full-stack Release Order Management System for **InNews 24x7**, a Kannada/Marathi cable news channel in Belagavi, KA.

## Architecture

- **Frontend** (`artifacts/roms`): React + Vite + Tailwind + shadcn/ui, served at `/`
- **API Server** (`artifacts/api-server`): Express + Drizzle ORM + PostgreSQL, served at `/api`
- **DB** (`lib/db`): Drizzle schema + migrations
- **API Client** (`lib/api-client-react`): Orval-generated React Query hooks
- **API Zod** (`lib/api-zod`): Orval-generated Zod validation schemas
- **API Spec** (`lib/api-spec/openapi.yaml`): Full OpenAPI 3.0 spec

## Running the App

Both workflows auto-start:
- `artifacts/api-server: API Server` — Express API on PORT env
- `artifacts/roms: web` — Vite dev server on PORT env

## Seed Accounts

| Role        | Username | Password  |
|-------------|----------|-----------|
| Management  | admin    | admin123  |
| Operations  | ops1     | ops123    |
| Coordinator | coord1   | coord123  |
| Sales       | sales1   | sales123  |

## Key Design Decisions

- **Auth**: Session-based (Bearer token in Authorization header), SHA-256 password hashing with SESSION_SECRET salt, sessions in DB
- **Invoice format**: Matches supplied PDF — "News 27 Media Networks / InNews 24x7", Union Bank, GSTIN 29AAPFN6292A1ZY, `IN/<FY>/<n>`, CGST+SGST @9% each
- **RO numbering**: `RO/<year>/<seq>` auto-generated
- **4 roles**: management, operations, coordinator, sales — enforced server-side

## User Preferences

- Kannada/Marathi channel — bilingual scroll tracking (scroll_kannada, scroll_marathi)
- Invoice print view must match exact PDF format with print CSS
