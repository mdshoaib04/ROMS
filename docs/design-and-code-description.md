# InNews ROMS — Design & Code Description

**InNews 24x7 Release Order Management System**  
*Kannada/Marathi Cable News Channel, Belagavi, KA*

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Database Schema](#3-database-schema)
4. [API Server](#4-api-server)
5. [OpenAPI Specification](#5-openapi-specification)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Authentication Flow](#7-authentication-flow)
8. [Design System](#8-design-system)
9. [Pages & Components](#9-pages--components)
10. [Generated Code (Orval)](#10-generated-code-orval)
11. [Build System](#11-build-system)
12. [Role-Based Access Matrix](#12-role-based-access-matrix)
13. [Data Flow: Full RO Lifecycle](#13-data-flow-full-ro-lifecycle)
14. [Seed Data & Initial Accounts](#14-seed-data--initial-accounts)

---

## 1. Project Overview

InNews ROMS is a full-stack internal operations tool that manages the complete lifecycle of a broadcast Release Order (RO) — from client intake through media approval, playout scheduling, coordinator reporting, invoice generation, and payment collection.

### Business domain

InNews 24x7 sells advertising air time in two formats across two languages:

- **Scroll** — a ticker-style banner running across the bottom of the screen, in Kannada and/or Marathi
- **Audio/Video spot** — a full broadcast ad, in Kannada and/or Marathi

An RO is the legal record of a placement booking. It captures the client, optional intermediary agency/freelancer, date range, media types selected, rate per spot, spot type (prime, repeat, L-band, aston), duration, and bonus spots. Coordinators later file playout reports showing scheduled vs. actual spots aired. Finance raises GST-compliant invoices and tracks payments.

### Legal & financial identifiers

| Field | Format | Example |
|---|---|---|
| RO Number | `RO/<year>/<seq>` | `RO/2025/0001` |
| Invoice Number | `IN/<FY>/<seq>` | `IN/2025-26/001` |
| Entity name on invoice | News 27 Media Networks / InNews 24x7 | — |
| GSTIN | 29AAPFN6292A1ZY | — |
| Bank | Union Bank of India | — |
| GST split | CGST 9% + SGST 9% (toggleable) | — |

---

## 2. Monorepo Structure

```
workspace/
├── pnpm-workspace.yaml          # pnpm workspace definition
├── package.json                 # root scripts: typecheck:libs, build, etc.
├── tsconfig.base.json           # shared TS path aliases and strictness
│
├── lib/                         # shared packages (never deployed standalone)
│   ├── db/                      # Drizzle ORM schema + PostgreSQL client
│   │   ├── src/
│   │   │   ├── schema/          # one file per entity
│   │   │   │   ├── users.ts
│   │   │   │   ├── clients.ts
│   │   │   │   ├── agencies.ts
│   │   │   │   ├── releaseOrders.ts
│   │   │   │   ├── playoutReports.ts
│   │   │   │   ├── invoices.ts
│   │   │   │   ├── payments.ts
│   │   │   │   ├── notifications.ts
│   │   │   │   ├── sessions.ts
│   │   │   │   └── index.ts     # re-exports all schema + types
│   │   │   └── index.ts         # exports db client + all schema
│   │   └── drizzle.config.ts
│   │
│   ├── api-spec/
│   │   ├── openapi.yaml         # OpenAPI 3.1.0 specification (1,620 lines)
│   │   └── orval.config.ts      # Orval codegen config for both outputs
│   │
│   ├── api-client-react/        # generated React Query hooks (Orval output)
│   │   └── src/
│   │       ├── generated/api.ts # all useQuery / useMutation hooks
│   │       └── custom-fetch.ts  # fetch wrapper with Bearer token injection
│   │
│   └── api-zod/                 # generated Zod schemas (Orval output)
│       └── src/
│           └── generated/api.ts # all request/response Zod schemas
│
└── artifacts/                   # deployable services
    ├── api-server/              # Express + Drizzle API
    │   └── src/
    │       ├── app.ts           # Express setup (cors, cookieParser, json)
    │       ├── index.ts         # server bootstrap
    │       ├── lib/
    │       │   ├── auth.ts      # hashPassword, generateToken, requireAuth, requireRole
    │       │   └── logger.ts    # pino logger
    │       ├── routes/
    │       │   ├── index.ts     # mounts all routers under /api
    │       │   ├── health.ts
    │       │   ├── auth.ts
    │       │   ├── users.ts
    │       │   ├── clients.ts
    │       │   ├── agencies.ts
    │       │   ├── releaseOrders.ts
    │       │   ├── playoutReports.ts
    │       │   ├── invoices.ts
    │       │   ├── payments.ts
    │       │   ├── dashboard.ts
    │       │   └── notifications.ts
    │       └── build.mjs        # esbuild bundler script
    │
    ├── roms/                    # React + Vite frontend
    │   └── src/
    │       ├── App.tsx          # router, providers, ProtectedRoute
    │       ├── main.tsx
    │       ├── index.css        # design tokens, CSS variables, print styles
    │       ├── context/
    │       │   └── AuthContext.tsx
    │       ├── hooks/
    │       │   └── use-toast.ts
    │       ├── components/
    │       │   ├── layout/
    │       │   │   └── Shell.tsx    # sidebar shell, auth guard
    │       │   └── ui/              # shadcn/ui component library
    │       └── pages/
    │           ├── login.tsx
    │           ├── dashboard.tsx
    │           ├── release-orders.tsx
    │           ├── release-orders/
    │           │   ├── new.tsx
    │           │   └── detail.tsx
    │           ├── clients.tsx
    │           ├── clients/
    │           │   ├── new.tsx
    │           │   └── detail.tsx
    │           ├── playout-reports.tsx
    │           ├── playout-reports/
    │           │   ├── new.tsx
    │           │   └── detail.tsx
    │           ├── invoices.tsx
    │           ├── invoices/
    │           │   ├── new.tsx
    │           │   └── detail.tsx
    │           ├── payments.tsx
    │           ├── agencies.tsx
    │           ├── users.tsx
    │           ├── notifications.tsx
    │           └── not-found.tsx
    │
    └── mockup-sandbox/          # Vite component preview server (design tooling)
```

### Package dependency graph

```
api-server  ──depends──▶  @workspace/db
roms        ──depends──▶  @workspace/api-client-react
                           └──depends──▶  (uses fetch, no db)
api-spec    ──codegen──▶  api-client-react   (Orval)
                      ──▶  api-zod           (Orval)
```

---

## 3. Database Schema

All tables use PostgreSQL via Drizzle ORM with TypeScript inference. Numeric financial columns use `numeric(precision, scale)` to avoid floating-point rounding.

### Enums

```sql
user_role     = management | operations | coordinator | sales
agency_type   = agency | freelancer
ro_status     = draft | pending_approval | approved | rejected | active | completed | stopped
playout_status = draft | submitted | invoiced
invoice_status = draft | pending_approval | approved | sent | partially_paid | paid
payment_mode  = upi | cheque | bank_transfer | cash
notification_type = ro_approved | ro_rejected | ro_expiring | invoice_overdue
                  | playout_report_ready | coordinator_absent | invoice_delay
```

### Table: `users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | serial | PK | |
| username | text | NOT NULL, UNIQUE | login handle |
| name | text | NOT NULL | display name |
| email | text | NOT NULL | |
| phone | text | nullable | |
| password_hash | text | NOT NULL | SHA-256(password + SESSION_SECRET) |
| role | user_role | NOT NULL, default `sales` | drives all permissions |
| is_active | boolean | NOT NULL, default `true` | soft-disable accounts |
| created_at | timestamp | NOT NULL, defaultNow | |
| updated_at | timestamp | NOT NULL, defaultNow | |

### Table: `clients`

| Column | Type | Constraints |
|---|---|---|
| id | serial | PK |
| name | text | NOT NULL |
| contact_person | text | nullable |
| address | text | NOT NULL |
| phone | text | NOT NULL |
| email | text | nullable |
| gst_number | text | nullable |
| notes | text | nullable |
| created_at / updated_at | timestamp | NOT NULL |

### Table: `agencies`

| Column | Type | Notes |
|---|---|---|
| id | serial | PK |
| name | text | NOT NULL |
| type | agency_type | `agency` or `freelancer` |
| contact_person | text | nullable |
| phone / email | text | nullable |
| commission_percent | numeric(5,2) | default `0` — % deducted from invoice |
| created_at / updated_at | timestamp | |

### Table: `release_orders`

The central entity. Captures every RO attribute needed for invoicing.

| Column | Type | Notes |
|---|---|---|
| id | serial | PK |
| ro_number | text | UNIQUE — auto-generated `RO/<year>/<seq>` |
| client_id | integer | FK → clients |
| agency_id | integer | FK → agencies (nullable) |
| status | ro_status | state machine |
| ro_date | text | nullable — client's own RO date |
| client_ro_reference | text | nullable — client's reference number |
| publish_from | text | ISO date string (YYYY-MM-DD) |
| publish_to | text | ISO date string |
| scroll_kannada | boolean | default false |
| scroll_marathi | boolean | default false |
| audio_video_kannada | boolean | default false |
| audio_video_marathi | boolean | default false |
| repeat_times | integer | nullable — spots per day |
| spot_type | text | nullable — prime, repeat, L-band, aston |
| spot_duration | text | nullable — 15s, 30s, L-band, aston |
| rate_per_spot | numeric(10,2) | nullable |
| bonus_spots | integer | nullable |
| media_design_required | boolean | default false |
| media_url | text | nullable — link to creative asset |
| notes | text | nullable |
| rejection_reason | text | nullable |
| stop_reason | text | nullable |
| stopped_at | timestamp | nullable |
| revision_note | text | nullable |
| revision_applied_at | timestamp | nullable |
| approved_at | timestamp | nullable |
| approved_by | integer | FK → users (nullable) |
| created_by | integer | FK → users, NOT NULL |
| created_at / updated_at | timestamp | |

### Table: `playout_reports`

Filed by coordinators after a campaign period ends.

| Column | Type | Notes |
|---|---|---|
| id | serial | PK |
| release_order_id | integer | FK → release_orders |
| report_date | text | date of report filing |
| publish_from / publish_to | text | period covered |
| total_spots_scheduled | integer | NOT NULL |
| total_spots_aired | integer | NOT NULL |
| scroll_kannada_days | integer | nullable |
| scroll_marathi_days | integer | nullable |
| video_kannada_days | integer | nullable |
| video_marathi_days | integer | nullable |
| discrepancy_note | text | nullable — explains spot shortfall |
| screenshot_url | text | nullable |
| status | playout_status | draft → submitted → invoiced |
| created_by | integer | FK → users |
| created_at / updated_at | timestamp | |

### Table: `invoices`

Stores the full line-item breakdown matching the required print format.

| Column | Type | Notes |
|---|---|---|
| id | serial | PK |
| invoice_number | text | UNIQUE — auto-generated `IN/<FY>/<seq>` |
| client_id | integer | FK → clients |
| release_order_id | integer | FK → release_orders |
| playout_report_id | integer | FK → playout_reports (nullable) |
| agency_id | integer | FK → agencies (nullable) |
| ro_reference | text | nullable |
| publish_from / publish_to | text | billing period |
| scroll_kannada_days | integer | nullable |
| scroll_kannada_rate | numeric(10,2) | nullable |
| scroll_marathi_days | integer | nullable |
| scroll_marathi_rate | numeric(10,2) | nullable |
| video_kannada_days | integer | nullable |
| video_kannada_rate | numeric(10,2) | nullable |
| video_marathi_days | integer | nullable |
| video_marathi_rate | numeric(10,2) | nullable |
| video_creative_charges | numeric(10,2) | nullable |
| include_gst | boolean | default true |
| cgst_percent | numeric(5,2) | default `9` |
| sgst_percent | numeric(5,2) | default `9` |
| subtotal | numeric(12,2) | computed line-item sum |
| cgst_amount | numeric(12,2) | nullable |
| sgst_amount | numeric(12,2) | nullable |
| total_amount | numeric(12,2) | subtotal + CGST + SGST |
| paid_amount | numeric(12,2) | default `0` |
| commission_amount | numeric(12,2) | nullable — agency cut |
| status | invoice_status | state machine |
| aging_days | integer | nullable — days since sent |
| aging_status | text | nullable — normal / warning / overdue |
| sent_at | timestamp | nullable |
| approved_at | timestamp | nullable |
| paid_at | timestamp | nullable |
| created_by | integer | FK → users |
| created_at / updated_at | timestamp | |

### Table: `payments`

Each row is one payment receipt against an invoice.

| Column | Type | Notes |
|---|---|---|
| id | serial | PK |
| invoice_id | integer | FK → invoices |
| amount | numeric(12,2) | NOT NULL |
| payment_mode | payment_mode | upi / cheque / bank_transfer / cash |
| payment_reference | text | nullable — cheque no., UTR, etc. |
| payment_date | text | ISO date |
| notes | text | nullable |
| created_at | timestamp | |

*On INSERT, the API recalculates `invoices.paid_amount` and transitions status to `partially_paid` or `paid` automatically.*

### Table: `notifications`

| Column | Type |
|---|---|
| id | serial PK |
| user_id | integer FK → users |
| message | text NOT NULL |
| type | notification_type |
| related_id | integer nullable |
| related_type | text nullable — "release_order", "invoice", etc. |
| is_read | boolean default false |
| created_at | timestamp |

### Table: `sessions`

| Column | Type |
|---|---|
| id | serial PK |
| token | text UNIQUE NOT NULL |
| user_id | integer NOT NULL |
| expires_at | timestamp NOT NULL |
| created_at | timestamp |

Sessions expire after 7 days. The middleware checks `expires_at < NOW()` and rejects stale tokens.

---

## 4. API Server

**Runtime:** Node.js 20+ / ESM  
**Framework:** Express 5  
**ORM:** Drizzle ORM with `postgres` driver  
**Logging:** pino + pino-http  
**Build output:** single-file ESM bundle at `dist/index.mjs` via esbuild

### Middleware stack (`app.ts`)

```
pino-http  →  cors(all origins, credentials)  →  cookieParser  →  json  →  urlencoded  →  /api router
```

### Route index (`routes/index.ts`)

All routers are mounted at `/api` in this order:

```
health, auth, users, clients, agencies, releaseOrders,
playoutReports, invoices, payments, dashboard, notifications
```

---

### 4.1 Auth routes (`routes/auth.ts`)

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| POST | /auth/login | — | — | Validate credentials, create session, return `{ user, token }` |
| POST | /auth/logout | ✓ | any | Delete session from DB |
| GET | /auth/me | ✓ | any | Return sanitized current user (no passwordHash) |

**Login logic:**
1. Find user by username via `db.query.usersTable.findFirst`
2. Check `user.isActive`
3. Compare `hashPassword(password)` against stored hash
4. Insert into `sessionsTable` with `expiresAt = now + 7 days`
5. Return `{ user (sans passwordHash), token }`

### 4.2 Users routes (`routes/users.ts`)

All endpoints require `requireAuth` + `requireRole("management")`.

| Method | Path | Description |
|---|---|---|
| GET | /users | List all users, newest first, strip passwordHash |
| POST | /users | Create user, auto-hash password |
| GET | /users/:id | Get single user |
| PATCH | /users/:id | Update fields; if `password` present, re-hash |
| DELETE | /users/:id | Hard delete |

### 4.3 Clients routes (`routes/clients.ts`)

Requires `requireAuth` (all roles can read).

| Method | Path | Description |
|---|---|---|
| GET | /clients | List all; optional `?search=` queries `name` and `phone` via `ilike` |
| POST | /clients | Create; requires `name`, `address`, `phone` |
| GET | /clients/:id | Single client |
| PATCH | /clients/:id | Partial update |
| DELETE | /clients/:id | Hard delete |

### 4.4 Agencies routes (`routes/agencies.ts`)

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | /agencies | ✓ | any |
| POST | /agencies | ✓ | management, operations |
| PATCH | /agencies/:id | ✓ | management, operations |
| DELETE | /agencies/:id | ✓ | management, operations |

### 4.5 Release Orders routes (`routes/releaseOrders.ts`)

| Method | Path | Auth | Role | Notes |
|---|---|---|---|---|
| GET | /release-orders | ✓ | any | Filter by `?status=`, `?clientId=`, `?month=YYYY-MM` |
| POST | /release-orders | ✓ | operations, sales | Auto-generates `RO/<year>/<seq>`; initial status `pending_approval` |
| GET | /release-orders/:id | ✓ | any | |
| PATCH | /release-orders/:id | ✓ | operations | Editable while `draft` or `pending_approval` |
| DELETE | /release-orders/:id | ✓ | management | Hard delete |
| POST | /release-orders/:id/approve | ✓ | management | Sets status → `active`, records `approvedBy`, `approvedAt` |
| POST | /release-orders/:id/reject | ✓ | management | Requires `{ reason }`; status → `rejected` |
| POST | /release-orders/:id/stop | ✓ | management, operations | Requires `{ reason }`; status → `stopped` |
| POST | /release-orders/:id/revise | ✓ | operations | Requires `{ note }`; optionally updates `publishFrom/To` |

**RO number generation:**
```ts
const year = new Date().getFullYear();
const count = await db.select({ count: sql`COUNT(*)` }).from(releaseOrdersTable)...;
const seq = String(Number(count) + 1).padStart(4, "0");
const roNumber = `RO/${year}/${seq}`;
```

### 4.6 Playout Reports routes (`routes/playoutReports.ts`)

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | /playout-reports | ✓ | any — filter by `?releaseOrderId=`, `?month=` |
| POST | /playout-reports | ✓ | coordinator, operations |
| GET | /playout-reports/:id | ✓ | any |
| PATCH | /playout-reports/:id | ✓ | coordinator, operations |

### 4.7 Invoices routes (`routes/invoices.ts`)

| Method | Path | Auth | Role | Notes |
|---|---|---|---|---|
| GET | /invoices | ✓ | any | Filter by `?status=`, `?clientId=`, `?month=` |
| POST | /invoices | ✓ | operations | Auto-generates `IN/<FY>/<seq>`; calculates subtotal, GST amounts, total |
| GET | /invoices/:id | ✓ | any | Response includes denormalized `clientName`, `clientAddress`, `clientGst`, `agencyName` |
| PATCH | /invoices/:id | ✓ | operations | Recalculates totals on save |
| POST | /invoices/:id/approve | ✓ | management | status → `approved` |
| POST | /invoices/:id/send | ✓ | operations | status → `sent`, records `sentAt`, begins aging clock |

**Invoice number generation:**
```ts
// Fiscal year (April–March)
const now = new Date();
const fiscalYear = now.getMonth() >= 3
  ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}`
  : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`;
const invoiceNumber = `IN/${fiscalYear}/${seq.padStart(3, "0")}`;
```

**Calculation logic:**
```ts
const subtotal = (scrollKannadaDays * scrollKannadaRate)
               + (scrollMarathiDays * scrollMarathiRate)
               + (videoKannadaDays  * videoKannadaRate)
               + (videoMarathiDays  * videoMarathiRate)
               + videoCreativeCharges;
const cgstAmount = includeGst ? subtotal * cgstPercent / 100 : 0;
const sgstAmount = includeGst ? subtotal * sgstPercent / 100 : 0;
const totalAmount = subtotal + cgstAmount + sgstAmount;
const commissionAmount = agencyId ? totalAmount * commissionPercent / 100 : null;
```

### 4.8 Payments routes (`routes/payments.ts`)

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | /payments | ✓ | any — filter by `?invoiceId=`, `?clientId=` |
| POST | /payments | ✓ | operations, management |

**On payment POST:**
1. Insert payment record
2. Recalculate `paid_amount = SUM(payments where invoice_id = id)`
3. Transition invoice status: `paid_amount >= total_amount` → `paid`; else → `partially_paid`
4. If fully paid, set `paid_at = NOW()`

### 4.9 Dashboard routes (`routes/dashboard.ts`)

All require `requireAuth` (any role). Data is computed in memory from DB queries (no separate aggregation tables).

| Method | Path | Returns |
|---|---|---|
| GET | /dashboard/summary | `DashboardSummary` — KPI counts + revenue figures + recent activity |
| GET | /dashboard/active-media | `ReleaseOrder[]` — status `active` or `approved` |
| GET | /dashboard/expiring-soon | `ReleaseOrder[]` — active ROs with `publish_to` within 7 days |
| GET | /dashboard/pending-invoices | `Invoice[]` — status `sent`, `approved`, or `partially_paid` |

**DashboardSummary fields:**

| Field | Computed from |
|---|---|
| totalActiveROs | ROs with status `active` or `approved` |
| totalPendingApproval | ROs with status `pending_approval` |
| totalExpiringSoon | Active ROs with `publishTo` between now and now+7d |
| totalInvoicesPending | Invoices in `sent/approved/partially_paid` |
| invoicesPendingGeneration | Submitted playout reports not yet invoiced |
| totalRevenue | Sum of `totalAmount` on `paid` invoices |
| totalOutstanding | Sum of `(totalAmount - paidAmount)` on pending invoices |
| overdueInvoices | Pending invoices sent 30+ days ago |
| warningInvoices | Pending invoices sent 14–29 days ago |
| recentActivity | Last 5 ROs + last 5 invoices, sorted by `updatedAt` |

### 4.10 Notifications routes (`routes/notifications.ts`)

| Method | Path | Notes |
|---|---|---|
| GET | /notifications | Returns notifications for `req.user.id`; optional `?unread=true` |
| POST | /notifications/:id/read | Sets `is_read = true` |

### 4.11 Auth middleware (`lib/auth.ts`)

```ts
// Password hashing — note parentheses are critical for correct operator precedence
function hashPassword(password: string): string {
  return crypto.createHash("sha256")
    .update(password + (process.env.SESSION_SECRET || "inews-roms-secret"))
    .digest("hex");
}

// Token extraction — supports both Authorization header and cookie
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "")
              || req.cookies?.token;
  const user = await getSessionUser(token);
  if (!user || !user.isActive) return res.status(401).json({ error: "Invalid or expired session" });
  req.user = user;
  next();
}

// Role guard — variadic, accepts multiple allowed roles
function requireRole(...roles: string[]) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Insufficient permissions" });
    next();
  };
}
```

---

## 5. OpenAPI Specification

Located at `lib/api-spec/openapi.yaml` (OpenAPI 3.1.0, 1,620 lines).

**Server base:** `/api`

**Tags:** health, auth, users, clients, agencies, releaseOrders, playoutReports, invoices, payments, dashboard, notifications

### All defined paths

| Tag | Operation ID | Method | Path |
|---|---|---|---|
| health | healthCheck | GET | /healthz |
| auth | login | POST | /auth/login |
| auth | logout | POST | /auth/logout |
| auth | getMe | GET | /auth/me |
| users | listUsers | GET | /users |
| users | createUser | POST | /users |
| users | getUser | GET | /users/{id} |
| users | updateUser | PATCH | /users/{id} |
| users | deleteUser | DELETE | /users/{id} |
| clients | listClients | GET | /clients |
| clients | createClient | POST | /clients |
| clients | getClient | GET | /clients/{id} |
| clients | updateClient | PATCH | /clients/{id} |
| clients | deleteClient | DELETE | /clients/{id} |
| agencies | listAgencies | GET | /agencies |
| agencies | createAgency | POST | /agencies |
| agencies | updateAgency | PATCH | /agencies/{id} |
| agencies | deleteAgency | DELETE | /agencies/{id} |
| releaseOrders | listReleaseOrders | GET | /release-orders |
| releaseOrders | createReleaseOrder | POST | /release-orders |
| releaseOrders | getReleaseOrder | GET | /release-orders/{id} |
| releaseOrders | updateReleaseOrder | PATCH | /release-orders/{id} |
| releaseOrders | deleteReleaseOrder | DELETE | /release-orders/{id} |
| releaseOrders | approveReleaseOrder | POST | /release-orders/{id}/approve |
| releaseOrders | rejectReleaseOrder | POST | /release-orders/{id}/reject |
| releaseOrders | stopReleaseOrder | POST | /release-orders/{id}/stop |
| releaseOrders | reviseReleaseOrder | POST | /release-orders/{id}/revise |
| playoutReports | listPlayoutReports | GET | /playout-reports |
| playoutReports | createPlayoutReport | POST | /playout-reports |
| playoutReports | getPlayoutReport | GET | /playout-reports/{id} |
| playoutReports | updatePlayoutReport | PATCH | /playout-reports/{id} |
| invoices | listInvoices | GET | /invoices |
| invoices | createInvoice | POST | /invoices |
| invoices | getInvoice | GET | /invoices/{id} |
| invoices | updateInvoice | PATCH | /invoices/{id} |
| invoices | approveInvoice | POST | /invoices/{id}/approve |
| invoices | sendInvoice | POST | /invoices/{id}/send |
| payments | listPayments | GET | /payments |
| payments | recordPayment | POST | /payments |
| dashboard | getDashboardSummary | GET | /dashboard/summary |
| dashboard | getActiveMedia | GET | /dashboard/active-media |
| dashboard | getExpiringSoon | GET | /dashboard/expiring-soon |
| dashboard | getPendingInvoices | GET | /dashboard/pending-invoices |
| notifications | listNotifications | GET | /notifications |
| notifications | markNotificationRead | POST | /notifications/{id}/read |

**Total: 42 operations across 11 tags**

---

## 6. Frontend Architecture

**Framework:** React 18 + Vite 7  
**Routing:** Wouter (lightweight, path-based)  
**Data fetching:** TanStack React Query v5 + Orval-generated hooks  
**Forms:** React Hook Form + Zod resolvers  
**UI library:** shadcn/ui (Radix UI primitives + Tailwind)  
**CSS:** Tailwind CSS 4.0 with custom design token variables  
**Fonts:** Plus Jakarta Sans (UI), JetBrains Mono (data/numbers)

### Provider tree (`App.tsx`)

```
QueryClientProvider (TanStack Query)
  └─ TooltipProvider (Radix)
       └─ WouterRouter (base = import.meta.env.BASE_URL)
            └─ AuthProvider (AuthContext)
                 └─ Switch (routes)
                      └─ ProtectedRoute → Shell → <Page>
```

### Route definitions

| Path | Component | Shell |
|---|---|---|
| /login | Login | ✗ |
| / or /dashboard | Dashboard | ✓ |
| /release-orders | ReleaseOrders | ✓ |
| /release-orders/new | ReleaseOrderNew | ✓ |
| /release-orders/:id | ReleaseOrderDetail | ✓ |
| /clients | Clients | ✓ |
| /clients/new | ClientNew | ✓ |
| /clients/:id | ClientDetail | ✓ |
| /playout-reports | PlayoutReports | ✓ |
| /playout-reports/new | PlayoutReportNew | ✓ |
| /playout-reports/:id | PlayoutReportDetail | ✓ |
| /invoices | Invoices | ✓ |
| /invoices/new | InvoiceNew | ✓ |
| /invoices/:id | InvoiceDetail | ✓ |
| /payments | Payments | ✓ |
| /agencies | Agencies | ✓ |
| /users | Users | ✓ |
| /notifications | Notifications | ✓ |
| * | NotFound | ✗ |

---

## 7. Authentication Flow

### Login sequence

```
User → login.tsx form
  → useLogin() [POST /auth/login]
  → AuthContext.login(token)
  → localStorage.setItem("token", token)
  → navigate("/dashboard")
```

### API call sequence (authenticated)

```
Any page component
  → useListReleaseOrders() [generated hook]
  → customFetch("/api/release-orders")
  → reads setAuthTokenGetter() getter → localStorage.getItem("token")
  → adds header: Authorization: Bearer <token>
  → Express requireAuth middleware
  → reads token from header (or cookie fallback)
  → db.query.sessionsTable.findFirst({ where: token })
  → checks session.expiresAt > now
  → db.query.usersTable.findFirst({ where: userId })
  → attaches user to req.user
  → route handler executes
```

### Token getter setup (`AuthContext.tsx`)

```ts
useEffect(() => {
  setAuthTokenGetter(() => localStorage.getItem("token"));
  return () => setAuthTokenGetter(null);
}, []);
```

This registers a module-level getter in `custom-fetch.ts` so every generated hook automatically includes the token without per-call configuration.

### Auth guard (`Shell.tsx`)

```ts
const { user, isLoading } = useAuth();
const [, navigate] = useLocation();

useEffect(() => {
  if (!isLoading && !user) navigate("/login");
}, [user, isLoading]);

if (isLoading) return <LoadingSpinner />;
if (!user) return null;
// render full sidebar layout
```

### `GET /auth/me` hydration

On every app load, `AuthProvider` fires `useGetMe({ query: { enabled: !!token } })`. If the token is valid, the user state is populated (name, role, etc.). If the token is expired or missing, `error` fires → token cleared → redirect to `/login`.

---

## 8. Design System

### Visual concept

**"Newsroom Control Room"** — the UI is dense, fast to scan, and authoritative. It uses a dark sidebar as a control strip with a light content area for maximum readability of data-heavy tables and forms.

### Color palette

#### Light mode (`:root`)

| Token | HSL Value | Hex equivalent | Usage |
|---|---|---|---|
| `--background` | 210 20% 98% | #F8F9FA | Page background |
| `--foreground` | 220 20% 15% | #1E2330 | Body text |
| `--card` | 0 0% 100% | #FFFFFF | Card surfaces |
| `--primary` | 0 68% 51% | #D32F2F | InNews Red — CTA buttons, active nav |
| `--sidebar` | 220 20% 10% | #161B27 | Dark sidebar background |
| `--sidebar-foreground` | 210 20% 98% | #F8F9FA | Sidebar text |
| `--sidebar-primary` | 0 68% 51% | #D32F2F | Active nav item |
| `--sidebar-accent` | 220 20% 15% | #1E2330 | Hover nav item |
| `--muted` | 220 15% 94% | #EEF0F4 | Subtle backgrounds |
| `--muted-foreground` | 220 10% 40% | #5A6272 | Secondary text |
| `--destructive` | 0 84% 60% | #F44336 | Error, delete |
| `--ring` | 0 68% 51% | #D32F2F | Focus ring |
| `--chart-1` | 0 68% 51% | #D32F2F | InNews Red |
| `--chart-2` | 212 80% 42% | #1565C0 | InNews Blue |
| `--chart-3` | 35 90% 60% | #F9A825 | Amber |
| `--chart-4` | 160 60% 45% | #26A69A | Teal |
| `--chart-5` | 270 70% 50% | #7B1FA2 | Purple |

#### Dark mode (`.dark`)

Follows the same structure with darkened surface values and the same primary red.

### Typography

```css
--app-font-sans: 'Plus Jakarta Sans', sans-serif;  /* UI labels, headings, body */
--app-font-mono: 'JetBrains Mono', monospace;       /* amounts, RO numbers, invoice numbers */
--app-font-serif: Georgia, serif;                   /* (fallback only) */
--radius: 0.375rem;                                 /* base border radius */
```

### Print styles

The invoice detail page is the only printable surface. The CSS includes:

```css
@media print {
  .no-print { display: none; }     /* hides sidebar, header, browser chrome */
  * { -webkit-print-color-adjust: exact; }  /* preserves color fills */
}
```

The sidebar, mobile header, and action buttons all carry the `no-print` class.

### shadcn/ui components in use

`Button`, `Badge`, `Card` / `CardHeader` / `CardContent`, `Dialog` / `DialogContent`, `Input`, `Label`, `Select`, `Tabs` / `TabsList` / `TabsTrigger`, `Table` / `TableRow` / `TableCell`, `Skeleton`, `Separator`, `Popover`, `Tooltip`, `Switch`, `Checkbox`, `Toaster` (via `use-toast.ts`)

---

## 9. Pages & Components

### `Shell.tsx` — Layout & Navigation

The persistent sidebar shell wraps all authenticated pages. It:

- Renders the InNews 24x7 logo in the sidebar header
- Builds the nav list from a `navItems` array, filtered by `role` membership
- Shows the current user's name + role in the footer
- Shows an animated red dot notification badge on the bell icon
- Handles logout via `useLogout()` mutation
- Implements the auth guard (redirect to `/login` when unauthenticated)

**Nav items by role visibility:**

| Nav Item | management | operations | coordinator | sales |
|---|:---:|:---:|:---:|:---:|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Release Orders | ✓ | ✓ | ✓ | ✓ |
| Clients | ✓ | ✓ | — | ✓ |
| Playout Reports | ✓ | ✓ | ✓ | — |
| Invoices | ✓ | ✓ | — | — |
| Payments | ✓ | ✓ | — | — |
| Agencies | ✓ | ✓ | — | — |
| Users | ✓ | — | — | — |

---

### `login.tsx`

Dark-background centered card with the InNews logo above. Uses React Hook Form + Zod for validation:

```ts
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
```

On success: calls `AuthContext.login(res.token)`, navigates to `/dashboard`.  
On error: shows toast with server error message.  
API hook: `useLogin()` → `POST /auth/login`

---

### `dashboard.tsx`

Fires four parallel React Query calls:
- `useGetDashboardSummary()` → 8 KPI cards
- `useGetActiveMedia()` → active ROs table
- `useGetExpiringSoon()` → expiring within 7 days alert list
- `useGetPendingInvoices()` → invoices with aging status badges

KPI cards include: Total Active ROs, Pending Approval, Expiring Soon, Invoices Pending, Revenue (₹), Outstanding (₹), Overdue, Warning.

All cards show loading skeletons while fetching.

---

### `release-orders.tsx`

Data table with filter controls. Hooks: `useListReleaseOrders({ params: { status, clientId, month } })`.  
Status filter tabs: All / Draft / Pending / Approved / Active / Completed / Stopped  
Each row has a status `Badge` color-coded by status.  
"New RO" button → navigates to `/release-orders/new`.

---

### `release-orders/new.tsx`

Multi-field form with:
- Client selector (from `useListClients()`)
- Optional agency selector (from `useListAgencies()`)
- Date range picker (publish_from / publish_to)
- Media type checkboxes (scroll Kannada/Marathi, video Kannada/Marathi)
- Spot configuration (type, duration, rate, repeat times, bonus spots)
- Media design required toggle
- Notes textarea

Submits via `useCreateReleaseOrder()` → `POST /release-orders`.  
On success: navigates to the new RO's detail page.

---

### `release-orders/detail.tsx`

Shows full RO details in a card layout. Action buttons (role-gated):
- **Approve** (management) → `useApproveReleaseOrder()` → `POST /:id/approve`
- **Reject** (management) → opens dialog → `useRejectReleaseOrder()` → `POST /:id/reject`
- **Stop** (management/ops) → opens dialog → `useStopReleaseOrder()` → `POST /:id/stop`
- **Revise** (ops) → opens dialog → `useReviseReleaseOrder()` → `POST /:id/revise`

Status badge updates optimistically via React Query invalidation on mutation success.

---

### `clients.tsx` / `clients/new.tsx` / `clients/detail.tsx`

List page with search input (debounced `?search=` query param).  
New client form: name, contact person, address, phone, email, GST number, notes.  
Detail page: tabbed — **Profile** | **Release Orders** | **Invoices** | **Payments**.

---

### `playout-reports/new.tsx`

Coordinator form. Selects parent RO from `useListReleaseOrders({ params: { status: "active" } })`.  
Captures: report date, period, scheduled vs. aired spots, language-day breakdown, discrepancy notes.  
Submits via `useCreatePlayoutReport()`.

---

### `invoices/new.tsx`

Finance form. Selects client and RO, optionally links a playout report.  
Live calculation preview — subtotal, CGST (9%), SGST (9%), total update as values change.  
GST toggle: when `includeGst = false`, CGST and SGST amounts are ₹0.  
Submits via `useCreateInvoice()`.

---

### `invoices/detail.tsx`

Dual-mode view: **screen mode** (with action buttons) and **print mode** (A4 format).

Print view matches the required invoice format exactly:
```
Header: News 27 Media Networks logo + address + GSTIN 29AAPFN6292A1ZY + "TAX INVOICE"
Client block: name, address, GST number
Billing period + RO reference
Line items table: service | language | days | rate | amount
Subtotal row
CGST @ 9% row
SGST @ 9% row
TOTAL row (bold)
Payment terms + bank details (Union Bank)
```

Action buttons (screen-only): **Approve** (management), **Send to Client** (ops), **Print / Download** (all).

---

### `payments.tsx`

Table of all payments with invoice number and client name. "Record Payment" button opens a `Dialog` modal:
- Invoice selector (shows pending invoices only)
- Amount input
- Payment mode: UPI / Cheque / Bank Transfer / Cash
- Payment reference field
- Payment date picker

Submits via `useRecordPayment()` → `POST /payments`. React Query invalidates `listInvoices` and `listPayments` on success to update the table and dashboard.

---

### `agencies.tsx`

List of agencies and freelancers with commission %. Inline edit dialog for commission updates. Badge shows `agency` vs `freelancer` type.

---

### `users.tsx`

Management-only. Table of all staff accounts. Create user form in a dialog (username, name, email, role selector, phone, password). Toggle `isActive` to disable accounts without deletion.

---

### `notifications.tsx`

List of current user's notifications, newest first. Unread items highlighted. "Mark as read" action per notification. Notification types map to human-readable descriptions.

---

## 10. Generated Code (Orval)

Orval reads `lib/api-spec/openapi.yaml` and generates two outputs configured in `orval.config.ts`.

### `lib/api-client-react` — React Query hooks

Every OpenAPI `operationId` becomes a typed hook:

| Operation | Hook | Type |
|---|---|---|
| login | `useLogin()` | mutation |
| logout | `useLogout()` | mutation |
| getMe | `useGetMe(options?)` | query |
| listUsers | `useListUsers()` | query |
| createUser | `useCreateUser()` | mutation |
| updateUser | `useUpdateUser()` | mutation |
| deleteUser | `useDeleteUser()` | mutation |
| listClients | `useListClients(params?)` | query |
| createClient | `useCreateClient()` | mutation |
| listAgencies | `useListAgencies()` | query |
| listReleaseOrders | `useListReleaseOrders(params?)` | query |
| createReleaseOrder | `useCreateReleaseOrder()` | mutation |
| getReleaseOrder | `useGetReleaseOrder(id)` | query |
| approveReleaseOrder | `useApproveReleaseOrder()` | mutation |
| rejectReleaseOrder | `useRejectReleaseOrder()` | mutation |
| stopReleaseOrder | `useStopReleaseOrder()` | mutation |
| reviseReleaseOrder | `useReviseReleaseOrder()` | mutation |
| listPlayoutReports | `useListPlayoutReports(params?)` | query |
| createPlayoutReport | `useCreatePlayoutReport()` | mutation |
| listInvoices | `useListInvoices(params?)` | query |
| createInvoice | `useCreateInvoice()` | mutation |
| getInvoice | `useGetInvoice(id)` | query |
| approveInvoice | `useApproveInvoice()` | mutation |
| sendInvoice | `useSendInvoice()` | mutation |
| recordPayment | `useRecordPayment()` | mutation |
| getDashboardSummary | `useGetDashboardSummary()` | query |
| getActiveMedia | `useGetActiveMedia()` | query |
| getExpiringSoon | `useGetExpiringSoon()` | query |
| getPendingInvoices | `useGetPendingInvoices()` | query |
| listNotifications | `useListNotifications(params?)` | query |
| markNotificationRead | `useMarkNotificationRead()` | mutation |

All hooks are fully typed — request body types and response types flow from the OpenAPI schema through Zod inference.

### `lib/api-client-react/src/custom-fetch.ts`

The Orval-configured fetch adapter. Key capabilities:

- **`setBaseUrl(url)`** — prepends a base URL to relative paths (used in Expo; no-op in web)
- **`setAuthTokenGetter(getter)`** — registers a callback that provides the Bearer token before each request
- **Automatic Content-Type** — sets `application/json` when body looks like JSON
- **Error normalization** — wraps non-2xx responses in `ApiError` with body + status + request info
- **`responseType`** — supports `json`, `text`, `blob`, or `auto` (sniffs Content-Type)

### `lib/api-zod` — Zod schemas

Parallel output from the same OpenAPI spec, used for server-side input validation and type safety. Each schema corresponds to an OpenAPI `component/schema` entry (e.g., `LoginInput`, `ReleaseOrderInput`, `InvoiceInput`).

---

## 11. Build System

### API Server build (`artifacts/api-server/build.mjs`)

Uses `esbuild` with `esbuild-plugin-pino` to tree-shake pino worker threads:

```js
esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: "dist/index.mjs",
  sourcemap: true,
  plugins: [buildPluginPino({ transports: ["pino-pretty"] })],
});
```

Output size: ~2.3 MB (includes all node_modules in the bundle for portability).

**Dev workflow:** `pnpm run build && pnpm run start` — rebuilds on every workflow restart. A watcher is not used; the workflow restarts cleanly on change.

### Frontend build (`artifacts/roms/vite.config.ts`)

Standard Vite config with:
- `@vitejs/plugin-react` (HMR + Fast Refresh)
- `server.host: "0.0.0.0"` — required for Replit proxy
- `server.allowedHosts: true` — required for proxied iframe preview
- Path alias `@` → `./src`
- Assets alias `@assets` → `./attached_assets`
- `base: import.meta.env.BASE_URL` — picks up the Replit artifact path prefix

### Monorepo scripts

| Script | What it does |
|---|---|
| `pnpm run typecheck:libs` | `tsc --build` — rebuilds lib declaration files |
| `pnpm --filter @workspace/db run push` | `drizzle-kit push` — applies schema to PostgreSQL |
| `pnpm --filter @workspace/api-spec run generate` | Runs Orval → regenerates both `api-client-react` and `api-zod` |

---

## 12. Role-Based Access Matrix

### Frontend — nav visibility

| Feature | management | operations | coordinator | sales |
|---|:---:|:---:|:---:|:---:|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Release Orders (view) | ✓ | ✓ | ✓ | ✓ |
| Release Orders (create) | ✓ | ✓ | — | ✓ |
| Release Orders (approve/reject) | ✓ | — | — | — |
| Release Orders (stop) | ✓ | ✓ | — | — |
| Clients | ✓ | ✓ | — | ✓ |
| Playout Reports | ✓ | ✓ | ✓ | — |
| Invoices | ✓ | ✓ | — | — |
| Payments | ✓ | ✓ | — | — |
| Agencies | ✓ | ✓ | — | — |
| Users | ✓ | — | — | — |
| Notifications | ✓ | ✓ | ✓ | ✓ |

### Backend — route enforcement

| Endpoint group | Auth | Roles enforced |
|---|---|---|
| GET /clients, /agencies, /release-orders, /playout-reports, /invoices, /payments | requireAuth | any authenticated |
| POST /release-orders | requireAuth | operations, sales |
| POST /release-orders/:id/approve | requireAuth | management |
| POST /release-orders/:id/reject | requireAuth | management |
| POST /release-orders/:id/stop | requireAuth | management, operations |
| POST /playout-reports | requireAuth | coordinator, operations |
| POST /invoices | requireAuth | operations |
| POST /invoices/:id/approve | requireAuth | management |
| POST /invoices/:id/send | requireAuth | operations |
| POST /payments | requireAuth | operations, management |
| All /users endpoints | requireAuth | management only |
| POST /agencies, PATCH, DELETE | requireAuth | management, operations |

---

## 13. Data Flow: Full RO Lifecycle

```
1. INTAKE
   Sales/Ops creates RO → POST /release-orders
   Status: pending_approval
   RO number auto-assigned: RO/<year>/<seq>
   Notification created for management users

2. APPROVAL
   Management reviews → POST /release-orders/:id/approve
   Status: active
   approvedBy, approvedAt recorded
   ─ OR ─
   POST /release-orders/:id/reject (requires reason)
   Status: rejected

3. MEDIA DELIVERY (optional)
   Ops uploads creative URL → PATCH /release-orders/:id
   mediaUrl saved; mediaDesignRequired flag managed

4. PLAYOUT
   Campaign runs on air during publishFrom → publishTo
   Coordinator files daily/weekly playout report:
   POST /playout-reports
   Records: total_spots_scheduled vs total_spots_aired
   Language-day breakdown: scrollKannadaDays, videoKannadaDays, etc.
   Status: submitted

5. INVOICING
   Ops creates invoice from playout report:
   POST /invoices
   Invoice number: IN/<FY>/<seq>
   Line items computed from days × rate per media type
   CGST (9%) + SGST (9%) applied (toggleable)
   Agency commission deducted if applicable
   Status: draft

   Management approves → POST /invoices/:id/approve
   Status: approved

   Ops sends to client → POST /invoices/:id/send
   Status: sent, sentAt recorded
   Aging clock starts

6. PAYMENT COLLECTION
   On receipt, Ops records: POST /payments
   amount, paymentMode (UPI/cheque/bank_transfer/cash), reference, date
   API recalculates invoice.paid_amount
   If paid_amount >= total_amount: status → paid, paid_at recorded
   Else: status → partially_paid

7. COMPLETED / STOPPED
   When campaign ends naturally: status → completed
   If cancelled mid-run: POST /release-orders/:id/stop (requires reason)
   Status: stopped, stopReason + stoppedAt recorded
```

---

## 14. Seed Data & Initial Accounts

The database ships with the following seed records created at setup time.

### Users

| username | password | role | Name |
|---|---|---|---|
| admin | admin123 | management | Rajashekar Patil |
| ops1 | ops123 | operations | Meera Kulkarni |
| coord1 | coord123 | coordinator | Suresh Jadhav |
| sales1 | sales123 | sales | Priya Desai |

### Clients

- Mahindra Finance (Tilakwadi, Belagavi) — GST: 29ABCDE1234F1ZS
- SBI Bank Belagavi (Club Road) — GST: 29SBIN0000001Z1
- Raj Motors (Hindwadi) — no GST

### Agencies

- Sunrise Media (agency) — 15% commission
- Venkat Freelance (freelancer) — 10% commission

### Sample ROs

| RO Number | Client | Status | Period |
|---|---|---|---|
| RO/2025/0001 | Mahindra Finance | active | 2025-07-01 – 2025-07-31 |
| RO/2025/0002 | SBI Bank Belagavi | pending_approval | 2025-07-15 – 2025-07-31 |
| RO/2025/0003 | Raj Motors | active | 2025-07-06 – 2025-07-24 |

### Sample Invoice

- **IN/2025-26/001** — Mahindra Finance, ₹1,50,000 subtotal + ₹27,000 GST = **₹1,77,000 total**, status: sent (20 days ago, approaching warning threshold)

### Password hashing note

Passwords are hashed as `SHA-256(password + SESSION_SECRET)` where `SESSION_SECRET` is a Replit environment secret. If the secret changes or the app is cloned to a new environment, passwords must be reseeded:

```bash
node -e "
  const c = require('crypto'), s = process.env.SESSION_SECRET || 'inews-roms-secret';
  ['admin123','ops123','coord123','sales123'].forEach(p =>
    console.log(p, c.createHash('sha256').update(p + s).digest('hex'))
  );
"
# Then UPDATE users SET password_hash = $hash WHERE username = $user
```

---

*Document generated: July 2026. Reflects the current state of the InNews ROMS codebase.*
