# Product Requirements Document (PRD)

## Kinecto — Loyalty & Customer Engagement Platform

| Field             | Value          |
| ----------------- | -------------- |
| **Product Name**  | Kinecto        |
| **Version**       | 1.0            |
| **Date**          | March 22, 2026 |
| **Status**        | Draft          |
| **Owner**         | TBD            |
| **Target Launch** | TBD            |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Vision & Goals](#3-vision--goals)
4. [Target Users & Personas](#4-target-users--personas)
5. [Functional Requirements](#5-functional-requirements)
    - 5.1 Multi-Tenant Architecture
    - 5.2 Authentication & Authorization
    - 5.3 Employee Interface (Tablet-Friendly)
    - 5.4 Customer Management (CRM)
    - 5.5 Messaging System
    - 5.6 Dashboard & Analytics
    - 5.7 Wallet Integration
    - 5.8 Settings & Configuration
    - 5.9 PWA Setup
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Technical Architecture](#7-technical-architecture)
8. [Data Model Overview](#8-data-model-overview)
9. [API & Integration Specifications](#9-api--integration-specifications)
10. [User Flows](#10-user-flows)
11. [UI/UX Requirements](#11-uiux-requirements)
12. [Security Requirements](#12-security-requirements)
13. [Milestones & Delivery Plan](#13-milestones--delivery-plan)
14. [Acceptance Criteria](#14-acceptance-criteria)
15. [Risks & Mitigations](#15-risks--mitigations)
16. [Glossary](#16-glossary)
17. [Extra Features](#17-extra-features)
18. [Appendices](#18-appendices)

---

## 1. Executive Summary

Kinecto is a **multi-tenant loyalty and customer engagement SaaS platform** purpose-built for small-to-medium businesses — cafes, salons, retail shops, and similar service-oriented establishments. The platform empowers business owners and their employees to manage customers, operate a points/credit-based loyalty program, send targeted marketing messages via WhatsApp and email, and monitor business activity through an intuitive dashboard.

The product is delivered as a **Progressive Web Application (PWA)** optimized for tablet use on the employee side and accessible via any modern browser for business owners. A digital wallet integration (Apple Wallet / Google Wallet) provides customers with a frictionless loyalty card experience.

The platform is built with a modern TypeScript-first stack: **Next.js + React + shadcn/ui** on the frontend, **Drizzle ORM** for type-safe database access, **Supabase Auth** (GoTrue) for authentication, **TanStack Query** for server state management, **Zustand** for minimal client state, **Supabase CLI** for local development (Postgres, Auth, Storage, Edge Functions), and **Supabase** for hosted production infrastructure.

### Key Differentiators

- **Zero hardware dependency** — works on any tablet or device with a browser
- **WhatsApp-native messaging** — meets customers where they already are
- **Digital wallet loyalty cards** — no physical cards to lose or forget
- **Multi-tenant by design** — each business is fully isolated
- **RTL-ready** — supports Arabic and other RTL languages from day one

---

## 2. Problem Statement

### The Current Reality

Small and medium businesses face significant challenges in customer retention and engagement:

1. **Paper-based loyalty programs** are easily lost, forgotten, or forged
2. **Customer data is scattered** across notebooks, spreadsheets, and memory
3. **No systematic communication** — businesses have no efficient way to reach customers with promotions or updates
4. **No visibility into customer behavior** — owners cannot identify their best customers, at-risk customers, or measure campaign effectiveness
5. **Existing solutions are either too complex** (enterprise CRM) **or too simplistic** (stamp card apps) for this market segment

### The Opportunity

There is a gap in the market for a platform that combines loyalty management, basic CRM, and targeted messaging in a single, affordable, easy-to-use product designed specifically for local businesses. WhatsApp's dominance in MENA and many global markets makes it the ideal communication channel.

---

## 3. Vision & Goals

### Product Vision

> Enable every local business to build lasting customer relationships through a simple, powerful loyalty and engagement platform.

### Primary Goals (v1.0)

| #   | Goal                                                  | Success Metric                             |
| --- | ----------------------------------------------------- | ------------------------------------------ |
| 1   | Enable businesses to digitize their loyalty program   | 100% of transactions recorded digitally    |
| 2   | Provide a fast, tablet-friendly employee interface    | < 10 seconds to find customer & add points |
| 3   | Allow businesses to communicate with customers        | Messages delivered via WhatsApp/email      |
| 4   | Give owners visibility into business activity         | Dashboard loads with key metrics in < 2s   |
| 5   | Deliver digital wallet loyalty cards to end customers | Cards issued via Apple/Google Wallet       |
| 6   | Ensure complete data isolation between tenants        | Zero cross-tenant data leakage             |

### Non-Goals (v1.0)

- Customer-facing mobile app (customers interact via wallet card and WhatsApp only)
- Advanced analytics or BI features
- E-commerce or POS integration
- Automated loyalty tiers or complex reward rules
- Multi-location management for a single business
- Payment processing

---

## 4. Target Users & Personas

### Persona 1: Business Owner ("Nora")

| Attribute        | Detail                                                             |
| ---------------- | ------------------------------------------------------------------ |
| **Role**         | Owner of a boutique café                                           |
| **Age**          | 28–45                                                              |
| **Tech Comfort** | Moderate — uses smartphone apps daily, comfortable with web        |
| **Goals**        | Grow repeat business, understand customer patterns, run promotions |
| **Pain Points**  | No time to manage complex tools, limited marketing budget          |
| **Device**       | Laptop or tablet (browser)                                         |

**Key Jobs to Be Done:**

- View how the business is performing (dashboard)
- Set up loyalty rewards and campaigns
- See who the top customers are
- Send a WhatsApp blast for a weekend promotion
- Manage employee access

### Persona 2: Employee ("Ahmed")

| Attribute        | Detail                                                       |
| ---------------- | ------------------------------------------------------------ |
| **Role**         | Barista / cashier / front desk                               |
| **Age**          | 20–35                                                        |
| **Tech Comfort** | High with phones/tablets, low with admin software            |
| **Goals**        | Quickly look up customers and add points during service      |
| **Pain Points**  | Slow systems disrupt customer flow, complex UIs cause errors |
| **Device**       | Shared tablet at counter (landscape orientation)             |

**Key Jobs to Be Done:**

- Search or scan a customer during checkout
- View customer balance and add/deduct points
- Register a new walk-in customer in under 30 seconds
- Confirm the transaction was applied

### Persona 3: End Customer ("Layla")

| Attribute        | Detail                                                  |
| ---------------- | ------------------------------------------------------- |
| **Role**         | Regular customer at a café or salon                     |
| **Age**          | 18–55                                                   |
| **Tech Comfort** | Uses WhatsApp daily                                     |
| **Goals**        | Earn and redeem rewards easily, receive relevant offers |
| **Pain Points**  | Loses paper cards, forgets about loyalty programs       |
| **Device**       | Smartphone (iOS/Android)                                |

**Key Jobs to Be Done:**

- Save loyalty card to phone wallet
- Check balance by opening wallet card
- Receive a WhatsApp message about a new offer
- Redeem points at the counter

---

## 5. Functional Requirements

### 5.1 Multi-Tenant Architecture

#### 5.1.1 Overview

Every registered business operates as an independent **tenant** within the platform. All data — customers, transactions, campaigns, settings — is scoped to the tenant and invisible to other tenants.

#### 5.1.2 Requirements

| ID     | Requirement                                                                           | Priority |
| ------ | ------------------------------------------------------------------------------------- | -------- |
| MT-001 | Each business registration creates a new tenant with a unique `tenant_id`             | P0       |
| MT-002 | All database queries MUST be scoped to the authenticated user's `tenant_id`           | P0       |
| MT-003 | Supabase Row-Level Security (RLS) policies enforce tenant isolation at the DB level   | P0       |
| MT-004 | Tenant can configure basic branding: business name, logo, primary color, accent color | P1       |
| MT-005 | Branding is applied to the employee interface and customer-facing wallet cards        | P1       |
| MT-006 | Tenant data cannot be accessed, modified, or listed by any other tenant               | P0       |
| MT-007 | Deleting a tenant soft-deletes all associated data                                    | P1       |

#### 5.1.3 Tenant Data Model (Conceptual)

```
tenant
├── id (UUID, PK)
├── name (business name)
├── logo_url
├── primary_color
├── accent_color
├── created_at
├── updated_at
├── status (active | suspended | deleted)
└── settings (JSONB — flexible config)
```

#### 5.1.4 Technical Notes

- RLS policies on every tenant-scoped table enforce tenant isolation at the database level
- Drizzle ORM schema definitions include tenant scoping on all queries via a shared `withTenantScope()` helper
- Supabase Auth JWT carries `tenantId` and `role` as custom claims in `app_metadata`
- A `get_tenant_id()` Postgres function extracts the tenant from the JWT claim for RLS policies
- Supabase CLI (`supabase start`) runs the full Supabase stack locally via Docker — Postgres, Auth (GoTrue), Storage, Edge Functions, and Studio UI

---

### 5.2 Authentication & Authorization

#### 5.2.1 Overview

The platform supports two internal roles per tenant: **Owner** and **Employee**. Authentication is handled by **Supabase Auth** (GoTrue), which provides JWT-based session management, email/password auth, and social login capabilities. Authorization is enforced both at the application level (UI route guards, TanStack Query middleware) and at the database level (RLS + role checks via Drizzle ORM query scoping).

#### 5.2.2 Requirements

| ID     | Requirement                                                        | Priority |
| ------ | ------------------------------------------------------------------ | -------- |
| AU-001 | Business owner can sign up with email + password (Supabase Auth)   | P0       |
| AU-002 | Sign-up creates a new tenant and assigns the user the `owner` role | P0       |
| AU-003 | Owner can invite employees by email or generate a join link        | P0       |
| AU-004 | Employees sign in with email + password                            | P0       |
| AU-005 | Supabase Auth JWT includes `tenantId` and `role` in `app_metadata` | P0       |
| AU-006 | JWT + refresh token session management (Supabase Auth)             | P0       |
| AU-007 | Password reset flow via email (Supabase Auth built-in)             | P1       |
| AU-008 | Owner can deactivate an employee account                           | P1       |
| AU-009 | Inactive sessions expire after 24 hours (configurable)             | P2       |

#### 5.2.3 Role Permissions Matrix

| Action                   | Owner | Employee     |
| ------------------------ | ----- | ------------ |
| View dashboard           | ✅    | ❌           |
| Manage customers         | ✅    | ✅           |
| Add/deduct points        | ✅    | ✅           |
| Register new customer    | ✅    | ✅           |
| View transaction history | ✅    | ✅ (limited) |
| Send messages            | ✅    | ❌           |
| Manage campaigns         | ✅    | ❌           |
| View analytics           | ✅    | ❌           |
| Manage settings          | ✅    | ❌           |
| Manage employees         | ✅    | ❌           |
| Manage API keys          | ✅    | ❌           |
| Manage branding          | ✅    | ❌           |

---

### 5.3 Employee Interface (Tablet-Friendly)

#### 5.3.1 Overview

The employee interface is the **primary operational screen** used during business hours. It must be fast, minimal, and optimized for tablet displays in landscape orientation. The core workflow is: **find customer → view balance → adjust points → confirm**.

#### 5.3.2 Requirements

| ID     | Requirement                                                                         | Priority |
| ------ | ----------------------------------------------------------------------------------- | -------- |
| EI-001 | Search customers by name, phone number, or scanned QR code                          | P0       |
| EI-002 | QR scanning uses the device camera via a web-based scanner library                  | P0       |
| EI-003 | Display customer profile card: name, phone, current balance/points, membership date | P0       |
| EI-004 | Add points/credit to customer balance with a reason/note                            | P0       |
| EI-005 | Deduct points/credit from customer balance with a reason/note                       | P0       |
| EI-006 | Confirmation dialog before committing any point adjustment                          | P0       |
| EI-007 | Show success/failure feedback after transaction                                     | P0       |
| EI-008 | Register a new customer inline (name, phone number, optional email)                 | P0       |
| EI-009 | Auto-generate QR code for newly registered customers                                | P1       |
| EI-010 | View last 5 transactions for the selected customer                                  | P1       |
| EI-011 | Interface works in landscape and portrait orientation                               | P1       |
| EI-012 | Large touch targets (minimum 44×44 px) for all interactive elements                 | P0       |
| EI-013 | Response time < 500ms for search results                                            | P0       |
| EI-014 | Offline indicator when network is unavailable                                       | P2       |

#### 5.3.3 Screen Layout (Tablet — Landscape)

```
┌──────────────────────────────────────────────────────────────┐
│  🔍 Search / Scan          [Business Logo]      [Employee ▾] │
├──────────────────────┬───────────────────────────────────────┤
│                      │                                       │
│  Search Results      │   Customer Profile Card               │
│  ┌──────────────┐    │   ┌───────────────────────────────┐   │
│  │ Customer 1   │    │   │  Name: Layla Hassan           │   │
│  │ Customer 2   │◄───│   │  Phone: +971 50 XXX XXXX      │   │
│  │ Customer 3   │    │   │  Points: 245                  │   │
│  └──────────────┘    │   │  Member Since: Jan 2026       │   │
│                      │   └───────────────────────────────┘   │
│  [+ New Customer]    │                                       │
│                      │   [ + Add Points ] [ − Deduct Points ]│
│                      │                                       │
│                      │   Recent Transactions                 │
│                      │   • +10 pts — Coffee purchase (Today) │
│                      │   • −50 pts — Reward redeemed (Mar 20)│
│                      │   • +10 pts — Coffee purchase (Mar 18)│
└──────────────────────┴───────────────────────────────────────┘
```

#### 5.3.4 QR Code Flow

1. Employee taps "Scan" button
2. Camera viewfinder opens as an overlay
3. Customer shows their QR code (from wallet card or printed)
4. System decodes QR → extracts `customer_id`
5. Customer profile loads automatically
6. Camera overlay closes

**QR Code Format:** `https://{app-domain}/c/{customer_uuid}` — the embedded URL doubles as a deep link.

---

### 5.4 Customer Management (CRM)

#### 5.4.1 Overview

The CRM module provides the business owner with a complete view of their customer base. It is accessible from the owner's dashboard and supports searching, filtering, segmenting, and viewing individual customer profiles.

#### 5.4.2 Requirements

| ID     | Requirement                                                                       | Priority |
| ------ | --------------------------------------------------------------------------------- | -------- |
| CM-001 | Store customer record: name, phone, email (optional), points/balance, tags, notes | P0       |
| CM-002 | Customer list view with search (name, phone) and pagination                       | P0       |
| CM-003 | Filter customers by: points range, last visit date, tags, registration date       | P1       |
| CM-004 | Sort customer list by: name, points (asc/desc), last activity, registration date  | P1       |
| CM-005 | Individual customer detail view with full profile and transaction history         | P0       |
| CM-006 | Transaction history shows: date, type (credit/debit), amount, note, performed by  | P0       |
| CM-007 | Add/edit tags on customer records for segmentation                                | P1       |
| CM-008 | Basic segmentation: create named segments from filter criteria                    | P1       |
| CM-009 | Bulk select customers for messaging                                               | P1       |
| CM-010 | Export customer list as CSV                                                       | P2       |
| CM-011 | Customer record includes `created_at`, `updated_at`, `last_visit_at` timestamps   | P0       |
| CM-012 | Customer phone numbers are unique per tenant                                      | P0       |
| CM-013 | Soft-delete customers (mark inactive, retain data for reporting)                  | P1       |

#### 5.4.3 Customer Data Model (Conceptual)

```
customer
├── id (UUID, PK)
├── tenant_id (FK → tenant.id)
├── name
├── phone (unique per tenant)
├── email (nullable)
├── points_balance (integer, default 0)
├── tags (text[])
├── notes (text, nullable)
├── qr_code_url
├── wallet_pass_id (nullable — PassKit reference)
├── status (active | inactive)
├── created_at
├── updated_at
├── last_visit_at
```

```
transaction
├── id (UUID, PK)
├── tenant_id (FK → tenant.id)
├── customer_id (FK → customer.id)
├── type (credit | debit)
├── amount (integer)
├── balance_after (integer)
├── note (text, nullable)
├── performed_by (FK → user.id)
├── created_at
```

#### 5.4.4 Segmentation Examples

| Segment Name     | Criteria                            |
| ---------------- | ----------------------------------- |
| VIP Customers    | Points balance ≥ 500                |
| At-Risk          | Last visit > 30 days ago            |
| New Customers    | Registered in the last 7 days       |
| High Value       | Total lifetime points earned ≥ 1000 |
| Tagged "Regular" | Tags contain "regular"              |

---

### 5.5 Messaging System

#### 5.5.1 Overview

The messaging system enables business owners to send targeted communications to customers via **WhatsApp** (primary channel) and **email** (secondary). Messages can be sent to individual customers, filtered segments, or the entire customer base.

#### 5.5.2 Requirements

| ID     | Requirement                                                                       | Priority |
| ------ | --------------------------------------------------------------------------------- | -------- |
| MS-001 | Send WhatsApp messages via a supported API provider (e.g., WhatsApp Business API) | P0       |
| MS-002 | Message templates with variable substitution (`{{name}}`, `{{points}}`, etc.)     | P0       |
| MS-003 | Send to individual customer, segment, or all customers                            | P0       |
| MS-004 | Message queue system to handle batch sending (avoid rate limits)                  | P1       |
| MS-005 | Track delivery status per message: queued → sent → delivered → read → failed      | P0       |
| MS-006 | Send email messages via an email API provider (e.g., SendGrid, Resend)            | P1       |
| MS-007 | Campaign entity: name, channel, template, audience, scheduled time, status        | P0       |
| MS-008 | View campaign history with aggregate stats (sent, delivered, read, failed)        | P0       |
| MS-009 | Schedule campaigns for future delivery                                            | P2       |
| MS-010 | Rate limiting: respect WhatsApp API rate limits and implement backoff             | P0       |
| MS-011 | Opt-out handling: customers can reply STOP; system marks them as unsubscribed     | P1       |
| MS-012 | Owner can preview message before sending                                          | P1       |
| MS-013 | Validate phone numbers before sending WhatsApp messages                           | P1       |

#### 5.5.3 Campaign Data Model (Conceptual)

```
campaign
├── id (UUID, PK)
├── tenant_id (FK → tenant.id)
├── name
├── channel (whatsapp | email)
├── template_content (text — with placeholders)
├── audience_type (all | segment | manual)
├── audience_filter (JSONB, nullable — segment criteria)
├── audience_customer_ids (UUID[], nullable — manual selection)
├── status (draft | scheduled | sending | sent | failed)
├── scheduled_at (timestamp, nullable)
├── sent_at (timestamp, nullable)
├── stats (JSONB — { total, sent, delivered, read, failed })
├── created_by (FK → user.id)
├── created_at
├── updated_at
```

```
message
├── id (UUID, PK)
├── tenant_id (FK → tenant.id)
├── campaign_id (FK → campaign.id, nullable)
├── customer_id (FK → customer.id)
├── channel (whatsapp | email)
├── content (text — rendered)
├── status (queued | sent | delivered | read | failed)
├── external_id (text — provider reference)
├── error_message (text, nullable)
├── sent_at
├── delivered_at
├── read_at
├── created_at
```

#### 5.5.4 WhatsApp Integration Flow

```
┌─────────┐     ┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Owner   │────▶│ Campaign │────▶│  Message      │────▶│  WhatsApp    │
│  creates │     │  Engine   │     │  Queue        │     │  Business    │
│ campaign │     │ resolves  │     │ (rate-limited)│     │  API         │
│          │     │ audience  │     │               │     │              │
└─────────┘     └──────────┘     └──────────────┘     └──────┬───────┘
                                                              │
                                                              ▼
                                                     ┌──────────────┐
                                                     │  Webhook      │
                                                     │  (status      │
                                                     │   updates)    │
                                                     └──────────────┘
```

#### 5.5.5 Template Variables

| Variable            | Description            | Example Output   |
| ------------------- | ---------------------- | ---------------- |
| `{{customer_name}}` | Customer's full name   | Layla Hassan     |
| `{{first_name}}`    | Customer's first name  | Layla            |
| `{{points}}`        | Current points balance | 245              |
| `{{business_name}}` | Tenant's business name | Brew & Bean Café |

---

### 5.6 Dashboard & Analytics

#### 5.6.1 Overview

The dashboard is the **owner's home screen** — it provides at-a-glance business health metrics and quick access to key functions. It focuses on essential, actionable data rather than complex analytics.

#### 5.6.2 Requirements

| ID     | Requirement                                                     | Priority |
| ------ | --------------------------------------------------------------- | -------- |
| DA-001 | Display total customer count                                    | P0       |
| DA-002 | Display active customers (visited in last 30 days)              | P0       |
| DA-003 | Display new customers (registered in last 7 days)               | P0       |
| DA-004 | Display total points issued (last 30 days)                      | P1       |
| DA-005 | Display total points redeemed (last 30 days)                    | P1       |
| DA-006 | Basic campaign stats: messages sent, delivery rate              | P0       |
| DA-007 | Customer list with search and filter (embedded from CRM module) | P0       |
| DA-008 | Quick actions: New Campaign, Add Customer, View Reports         | P1       |
| DA-009 | Date range selector for metrics (7d / 30d / 90d / custom)       | P2       |
| DA-010 | Simple line chart: new customers over time (last 30 days)       | P2       |
| DA-011 | Simple bar chart: points issued vs. redeemed (last 30 days)     | P2       |
| DA-012 | Dashboard loads within 2 seconds on standard broadband          | P0       |
| DA-013 | All metrics are tenant-scoped (no cross-tenant data leakage)    | P0       |

#### 5.6.3 Dashboard Layout (Conceptual)

```
┌─────────────────────────────────────────────────────────────────┐
│  Kinecto Dashboard                    [+ New Campaign]  [⚙️]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Total    │  │ Active   │  │ New This │  │ Messages │         │
│  │ Customers│  │ (30d)    │  │ Week     │  │ Sent     │         │
│  │   847    │  │   312    │  │    23    │  │  1,204   │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│                                                                 │
│  ┌─────────────────────────────┐  ┌────────────────────────┐    │
│  │  New Customers (30d chart)  │  │  Points Activity       │    │
│  │  📈                         │  │  Issued: 12,450        │    │
│  │                             │  │  Redeemed: 8,200       │    │
│  └─────────────────────────────┘  └────────────────────────┘    │
│                                                                 │
│  Recent Campaigns                                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Name              │ Channel  │ Sent │ Delivered │ Status  │  │
│  │ Weekend Special   │ WhatsApp │  200 │      185  │ Done    │  │
│  │ New Menu Alert    │ Email    │  500 │      462  │ Done    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Customer List  [Search: ___________] [Filter ▾]                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Name           │ Phone        │ Points │ Last Visit       │  │
│  │ Layla Hassan   │ +971 50 XXX  │   245  │ Today            │  │
│  │ Omar Ali       │ +971 55 XXX  │   120  │ 2 days ago       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5.7 Wallet Integration

#### 5.7.1 Overview

Customers receive a **digital loyalty card** stored in Apple Wallet (iOS) or Google Wallet (Android). The card displays their current points balance and updates automatically when points change. Cards are generated and managed via the **PassKit** API.

#### 5.7.2 Requirements

| ID     | Requirement                                                                        | Priority |
| ------ | ---------------------------------------------------------------------------------- | -------- |
| WI-001 | Generate a digital loyalty card for each customer via PassKit API                  | P0       |
| WI-002 | Card displays: business name, customer name, points balance, QR code               | P0       |
| WI-003 | Card uses tenant branding (logo, colors)                                           | P1       |
| WI-004 | Card QR code encodes the customer's unique identifier for scanning                 | P0       |
| WI-005 | Card is delivered to the customer via a download link (WhatsApp or email)          | P0       |
| WI-006 | When points change, the card balance updates automatically via PassKit push update | P0       |
| WI-007 | Support both Apple Wallet (.pkpass) and Google Wallet formats                      | P0       |
| WI-008 | Wallet card generation is triggered on customer registration                       | P1       |
| WI-009 | Re-issue card if customer requests a new one                                       | P2       |
| WI-010 | Track which customers have installed their wallet card                             | P2       |

#### 5.7.3 Wallet Card Lifecycle

```
Customer Registered
       │
       ▼
 PassKit API: Create Pass
       │
       ▼
 Generate Download Link
       │
       ▼
 Send Link via WhatsApp/Email
       │
       ▼
 Customer Adds to Wallet
       │
       ▼
 Points Updated (transaction)
       │
       ▼
 PassKit API: Push Update
       │
       ▼
 Card Reflects New Balance
```

#### 5.7.4 PassKit Integration Details

| Concern           | Approach                                                                 |
| ----------------- | ------------------------------------------------------------------------ |
| **Pass Template** | One template per tenant (branded)                                        |
| **Pass Fields**   | `points` (primary), `name` (secondary), `member_since` (aux)             |
| **QR Code**       | Encodes customer URL: `https://{domain}/c/{customer_uuid}`               |
| **Updates**       | Push via PassKit when `points_balance` changes in DB                     |
| **Trigger**       | Database webhook or server-side hook on `customer.points_balance` change |

---

### 5.8 Settings & Configuration

#### 5.8.1 Overview

The settings section is available only to the **Owner** role and allows management of business configuration, API integrations, employee accounts, and branding.

#### 5.8.2 Requirements

| ID     | Requirement                                                                  | Priority |
| ------ | ---------------------------------------------------------------------------- | -------- |
| ST-001 | Business profile: edit name, logo, colors                                    | P0       |
| ST-002 | API key management: store/update WhatsApp API credentials                    | P0       |
| ST-003 | API key management: store/update PassKit API credentials                     | P0       |
| ST-004 | API key management: store/update Email API credentials                       | P1       |
| ST-005 | Employee management: invite, list, deactivate employees                      | P0       |
| ST-006 | Role display (owner cannot change own role)                                  | P1       |
| ST-007 | Points configuration: set points name (e.g., "Stars", "Points", "Credits")   | P2       |
| ST-008 | API keys are encrypted at rest and never exposed in full after initial entry | P0       |
| ST-009 | Danger zone: delete account (with confirmation and waiting period)           | P2       |

#### 5.8.3 Settings Navigation

```
Settings
├── Business Profile
│   ├── Name
│   ├── Logo Upload
│   └── Brand Colors
├── Integrations
│   ├── WhatsApp API
│   ├── PassKit API
│   └── Email API
├── Team
│   ├── Invite Employee
│   └── Employee List (with deactivate action)
└── Account
    ├── Password Change
    └── Delete Account
```

---

### 5.9 PWA Setup

#### 5.9.1 Overview

The application is delivered as a **Progressive Web App** (PWA) to enable an app-like experience without requiring app store distribution. This is particularly important for the employee interface, which will be used on shared tablets.

#### 5.9.2 Requirements

| ID     | Requirement                                                                  | Priority |
| ------ | ---------------------------------------------------------------------------- | -------- |
| PW-001 | Valid `manifest.json` with app name, icons, theme color, display: standalone | P0       |
| PW-002 | Service worker for basic asset caching (app shell model)                     | P0       |
| PW-003 | "Add to Home Screen" prompt supported on Chrome and Safari                   | P0       |
| PW-004 | App launches in standalone mode (no browser chrome)                          | P0       |
| PW-005 | Splash screen with business branding during load                             | P2       |
| PW-006 | Cache static assets (JS, CSS, images) for faster subsequent loads            | P1       |
| PW-007 | Network-first strategy for API calls (always fetch fresh data)               | P0       |
| PW-008 | Offline fallback page when network is unavailable                            | P2       |
| PW-009 | Auto-update: new service worker activates on next visit                      | P1       |
| PW-010 | Optimized for tablet viewport (768px – 1280px primary target)                | P0       |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Requirement                         | Target              |
| ----------------------------------- | ------------------- |
| Employee search response time       | < 500ms (p95)       |
| Dashboard initial load time         | < 2 seconds         |
| Time to Interactive (TTI)           | < 3 seconds         |
| Largest Contentful Paint (LCP)      | < 2.5 seconds       |
| API response time (95th percentile) | < 1 second          |
| Concurrent users per tenant         | At least 10         |
| Message sending throughput          | 100 messages/minute |

### 6.2 Scalability

| Requirement                 | Target     |
| --------------------------- | ---------- |
| Number of tenants supported | 1,000+     |
| Customers per tenant        | 50,000+    |
| Transactions per tenant     | 1,000,000+ |
| Message history per tenant  | 500,000+   |

### 6.3 Reliability & Availability

| Requirement                                  | Target                           |
| -------------------------------------------- | -------------------------------- |
| Uptime SLA                                   | 99.9%                            |
| Database backups                             | Daily (Supabase managed in prod) |
| Graceful degradation if WhatsApp API is down | Queue messages, retry            |
| Zero data loss for transactions              | Transactions are atomic          |

### 6.4 Compatibility

| Requirement               | Target                                    |
| ------------------------- | ----------------------------------------- |
| Browsers                  | Chrome 90+, Safari 15+, Edge 90+          |
| Devices                   | iPad, Android tablets, desktops           |
| Primary tablet resolution | 768×1024 – 1280×800                       |
| RTL language support      | Arabic (full layout mirroring)            |
| Screen orientations       | Landscape (primary), Portrait (supported) |

### 6.5 Accessibility

| Requirement           | Target                  |
| --------------------- | ----------------------- |
| WCAG compliance level | 2.1 AA (minimum)        |
| Keyboard navigation   | Full support            |
| Screen reader support | Semantic HTML + ARIA    |
| Color contrast ratio  | ≥ 4.5:1                 |
| Focus indicators      | Visible on all elements |

### 6.6 Testing Strategy

| Layer           | Tool                     | Scope                                                      |
| --------------- | ------------------------ | ---------------------------------------------------------- |
| **Unit**        | Vitest                   | Utility functions, Zustand stores, data transformation     |
| **Integration** | Vitest + Drizzle + DB    | API routes with real Postgres (Supabase CLI test DB)       |
| **E2E**         | Playwright               | Full user flows: sign-up, add points, create campaign      |
| **RLS**         | Vitest + Supabase client | Cross-tenant isolation tests (verify zero data leakage)    |
| **Component**   | Vitest + Testing Library | shadcn/ui composites, form validation, conditional renders |

**Testing conventions:**

- Test files co-located with source: `*.test.ts` / `*.test.tsx`
- E2E tests in top-level `e2e/` directory
- CI pipeline runs unit + integration on every PR; E2E on merge to main
- RLS tests use two Supabase clients with different tenant JWTs to verify isolation

### 6.7 Rate Limiting

| Concern                     | Implementation                                                      |
| --------------------------- | ------------------------------------------------------------------- |
| **API route rate limiting** | Upstash Redis (`@upstash/ratelimit`) — sliding window per tenant/IP |
| **Auth endpoints**          | Supabase Auth built-in rate limits + Upstash for custom limits      |
| **Campaign message queue**  | Postgres-backed queue with configurable concurrency and batch size  |
| **WhatsApp API**            | Respect Meta tier limits; exponential backoff on 429 responses      |
| **Global fallback**         | Vercel Edge Middleware rate limiting for DDoS protection            |

---

## 7. Technical Architecture

### 7.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser / PWA)                      │
│                                                                     │
│  React + TypeScript + Tailwind CSS + shadcn/ui                      │
│  ├── Route Guards (role-based)                                      │
│  ├── TanStack Query (server state) + Zustand (client state)         │
│  ├── Supabase Auth Client (@supabase/ssr)                           │
│  ├── Service Worker (caching)                                       │
│  └── QR Scanner (camera API)                                        │
│                                                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API LAYER (Vercel)                             │
│                                                                     │
│  ┌─────────────────┐  ┌──────────────────────────┐                  │
│  ┌─────────────────┐  ┌──────────────────────────┐                  │
│  │  Supabase Auth   │  │  Next.js API Routes       │                  │
│  │  (GoTrue JWT,    │  │  ├── Drizzle ORM queries   │                  │
│  │   email/pass,    │  │  ├── Tenant-scoped logic   │                  │
│  │   social login)  │  │  └── Input validation (Zod) │                  │
│  └─────────────────┘  └──────────────────────────┘                  │
│                                                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     DATA & SERVICES                                  │
│                                                                     │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐              │
│  │  PostgreSQL   │  │   Supabase    │  │  Upstash    │              │
│  │  (Supabase    │  │   Storage     │  │  Redis      │              │
│  │   hosted /    │  │   (logos,     │  │  (rate      │              │
│  │   Supabase    │  │    assets)    │  │   limiting) │              │
│  │   CLI local)  │  │              │  │             │              │
│  └──────────────┘  └───────────────┘  └─────────────┘              │
│                                                                     │
└──────────┬──────────────────┬──────────────────┬────────────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │  WhatsApp    │  │   PassKit    │  │  Email API   │
   │  Business    │  │   API        │  │  (SendGrid/  │
   │  API         │  │              │  │   Resend)    │
   └──────────────┘  └──────────────┘  └──────────────┘
```

### 7.2 Tech Stack Details

| Layer             | Technology                                        | Purpose                              |
| ----------------- | ------------------------------------------------- | ------------------------------------ |
| **Frontend**      | React 18+                                         | UI framework                         |
| **Language**      | TypeScript 5+                                     | Type safety                          |
| **UI Components** | shadcn/ui (Radix UI primitives)                   | Accessible, composable component lib |
| **Styling**       | Tailwind CSS 3+                                   | Utility-first CSS                    |
| **Framework**     | Next.js 14+ (App Router)                          | Full-stack React framework           |
| **State**         | TanStack Query + Zustand                          | Server state + minimal client state  |
| **Forms**         | React Hook Form + Zod                             | Form handling + validation           |
| **Charts**        | Recharts or Chart.js                              | Dashboard visualizations             |
| **QR Scanning**   | html5-qrcode or similar                           | Camera-based QR reading              |
| **ORM**           | Drizzle ORM                                       | Type-safe DB schema + queries        |
| **Database**      | PostgreSQL (Supabase hosted / Supabase CLI local) | Primary data store                   |
| **Auth**          | Supabase Auth (GoTrue) + @supabase/ssr            | Authentication + JWT session mgmt    |
| **Storage**       | Supabase Storage                                  | File uploads (logos)                 |
| **Rate Limiting** | Upstash Redis (@upstash/ratelimit)                | API route rate limiting              |
| **Local Dev**     | Supabase CLI (`supabase start`)                   | Full local Supabase stack via Docker |
| **i18n**          | next-intl                                         | Internationalization (Arabic RTL)    |
| **Testing**       | Vitest + Playwright                               | Unit/integration + E2E testing       |
| **Hosting**       | Vercel                                            | Frontend + API deployment + CDN      |
| **PWA**           | Workbox / custom service worker                   | Caching + offline support            |
| **Integrations**  | PassKit SDK, WhatsApp Business API, Email API     | External services                    |

### 7.3 Project Structure (Next.js App Router)

```
app/
├── (auth)/
│   ├── login/page.tsx             # Sign in
│   ├── signup/page.tsx            # Sign up + tenant creation
│   └── reset-password/page.tsx    # Password reset
├── (dashboard)/
│   ├── layout.tsx                 # Authenticated layout (sidebar, nav)
│   ├── page.tsx                   # Dashboard home
│   ├── customers/
│   │   ├── page.tsx               # Customer list + search
│   │   └── [id]/page.tsx          # Customer detail + transactions
│   ├── campaigns/
│   │   ├── page.tsx               # Campaign list
│   │   ├── new/page.tsx           # Create campaign
│   │   └── [id]/page.tsx          # Campaign detail + stats
│   ├── wallet/page.tsx            # Wallet card management
│   └── settings/
│       ├── page.tsx               # General settings
│       ├── team/page.tsx          # Employee management
│       └── integrations/page.tsx  # API keys (WhatsApp, PassKit, Email)
├── employee/
│   ├── layout.tsx                 # Tablet-optimized layout
│   └── page.tsx                   # Employee interface (search, scan, points)
├── api/
│   ├── auth/[...supabase]/route.ts  # Supabase Auth callback handler
│   ├── customers/route.ts         # CRUD customers
│   ├── transactions/route.ts      # Points credit/debit
│   ├── campaigns/
│   │   ├── route.ts               # CRUD campaigns
│   │   └── send/route.ts          # Trigger campaign send
│   ├── messaging/
│   │   ├── whatsapp/route.ts      # Proxy to WhatsApp Business API
│   │   ├── email/route.ts         # Proxy to Email API
│   │   └── webhook/route.ts       # WhatsApp delivery status callbacks
│   ├── wallet/
│   │   ├── create/route.ts        # Create PassKit pass
│   │   └── update/route.ts        # Update PassKit pass (post-transaction)
│   └── dashboard/route.ts         # Aggregated metrics
├── layout.tsx                     # Root layout (providers, fonts, i18n)
├── globals.css                    # Tailwind + global styles
└── not-found.tsx                  # 404 page

lib/
├── supabase/
│   ├── client.ts                  # Browser Supabase client
│   ├── server.ts                  # Server Supabase client (cookies)
│   └── middleware.ts              # Auth middleware helper
├── db/
│   ├── schema/                    # Drizzle table definitions
│   ├── migrations/                # Drizzle Kit generated migrations
│   ├── index.ts                   # Drizzle client instance
│   └── seed.ts                    # Development seed data
├── store/                         # Zustand stores
│   ├── use-customer-store.ts      # Selected customer, UI state
│   └── use-tenant-store.ts        # Active tenant context, preferences
├── hooks/                         # Custom React hooks
├── queries/                       # TanStack Query definitions
│   ├── customers.ts
│   ├── campaigns.ts
│   ├── dashboard.ts
│   └── wallet.ts
├── types/                         # TypeScript types/interfaces
├── utils/                         # Helpers, formatters
└── i18n/                          # next-intl config + message files
    ├── request.ts                 # i18n request config
    └── messages/
        ├── en.json                # English strings
        └── ar.json                # Arabic strings

components/
├── ui/                            # shadcn/ui primitives (button, dialog, etc.)
├── layout/                        # Sidebar, header, nav
├── customers/                     # Customer-specific composites
├── campaigns/                     # Campaign-specific composites
├── dashboard/                     # Dashboard widgets, charts
└── shared/                        # Reusable composites

# Root-level files
supabase/                          # Supabase CLI project
├── config.toml                    # Supabase local config
├── migrations/                    # SQL migrations (can coexist with Drizzle)
└── functions/                     # Edge Functions (only webhook-whatsapp)
drizzle.config.ts                  # Drizzle Kit configuration
components.json                    # shadcn/ui configuration
middleware.ts                      # Next.js middleware (Supabase Auth refresh)
next.config.ts                     # Next.js config (i18n, redirects)
```

### 7.4 API Route Consolidation & Edge Functions

Most server-side logic is handled via **Next.js API routes** (`app/api/`), which run on Vercel's serverless infrastructure. This consolidates messaging proxies, wallet operations, and data endpoints into a single deployment.

Only the WhatsApp delivery status webhook remains as a **Supabase Edge Function**, because it must be publicly reachable and may process callbacks independently of the Next.js deployment.

| Function / Route               | Location               | Trigger                  | Purpose                              |
| ------------------------------ | ---------------------- | ------------------------ | ------------------------------------ |
| `POST /api/messaging/whatsapp` | Next.js API route      | Campaign send            | Proxy to WhatsApp Business API       |
| `POST /api/messaging/email`    | Next.js API route      | Campaign send            | Proxy to email API provider          |
| `POST /api/wallet/create`      | Next.js API route      | Customer registration    | Generate new wallet pass via PassKit |
| `POST /api/wallet/update`      | Next.js API route      | After points transaction | Push updated balance to PassKit      |
| `webhook-whatsapp`             | Supabase Edge Function | HTTP (WhatsApp callback) | Process delivery status updates      |

---

## 8. Data Model Overview

### 8.1 Entity Relationship Diagram (Conceptual)

```
┌──────────┐       ┌──────────┐       ┌──────────────┐
│  tenant   │──1:N──│  user     │       │  campaign     │
│           │       │ (owner/   │──1:N──│              │
│           │       │  employee)│       │              │
└─────┬────┘       └──────────┘       └──────┬───────┘
      │                                       │
      │ 1:N                                   │ 1:N
      ▼                                       ▼
┌──────────┐                           ┌──────────────┐
│ customer  │──────────────────────────│  message      │
│           │           1:N            │              │
└─────┬────┘                           └──────────────┘
      │
      │ 1:N
      ▼
┌──────────────┐
│ transaction   │
│              │
└──────────────┘
```

### 8.2 Core Tables Summary

| Table         | Description                           | Key Fields                                      |
| ------------- | ------------------------------------- | ----------------------------------------------- |
| `tenant`      | Business/organization                 | id, name, logo_url, settings, status            |
| `user`        | Owner or employee                     | id, tenant_id, email, role, status              |
| `customer`    | End customer of a business            | id, tenant_id, name, phone, points_balance      |
| `transaction` | Points credit or debit                | id, tenant_id, customer_id, type, amount        |
| `campaign`    | Marketing campaign                    | id, tenant_id, channel, status, stats           |
| `message`     | Individual message sent to a customer | id, tenant_id, campaign_id, customer_id, status |
| `segment`     | Saved customer filter/segment         | id, tenant_id, name, filter_criteria            |
| `api_key`     | Encrypted external API credentials    | id, tenant_id, service, encrypted_key           |

### 8.3 Database Conventions

- All tables use `UUID` primary keys (generated by `gen_random_uuid()`)
- All tenant-scoped tables include a `tenant_id` column with RLS policies
- Timestamps: `created_at` (default `now()`), `updated_at` (trigger-maintained)
- Soft deletes via `status` column where applicable
- Indexes on: `tenant_id`, `customer.phone`, `customer.name`, `transaction.customer_id`, `message.campaign_id`

---

## 9. API & Integration Specifications

### 9.1 Application API Layer

The frontend communicates with the server via **TanStack Query** hooks that call Next.js API routes. Database access is handled server-side through **Drizzle ORM** with tenant-scoped queries. Authentication is managed by **Supabase Auth** with JWT + refresh tokens via `@supabase/ssr`.

#### Key Operations — Supabase Auth

| Operation      | Supabase Auth Method                                           |
| -------------- | -------------------------------------------------------------- |
| Sign up        | `supabase.auth.signUp({ email, password, options: { data } })` |
| Sign in        | `supabase.auth.signInWithPassword({ email, password })`        |
| Sign out       | `supabase.auth.signOut()`                                      |
| Get session    | `supabase.auth.getSession()`                                   |
| Get user       | `supabase.auth.getUser()`                                      |
| Reset password | `supabase.auth.resetPasswordForEmail(email)`                   |

#### Key Operations — Drizzle ORM (Server-Side)

| Operation          | Drizzle Method                                                            |
| ------------------ | ------------------------------------------------------------------------- |
| List customers     | `db.select().from(customers).where(eq(customers.tenantId, tenantId))`     |
| Search customers   | `db.select().from(customers).where(and(eq(...tenantId), ilike(...name)))` |
| Create customer    | `db.insert(customers).values({ tenantId, name, phone, ... })`             |
| Create transaction | `db.transaction(async (tx) => { /* atomic update */ })`                   |
| Upload logo        | `supabase.storage.from('logos').upload()` (Supabase Storage retained)     |

#### Key Operations — TanStack Query (Client-Side)

| Operation         | TanStack Query Pattern                           |
| ----------------- | ------------------------------------------------ |
| Fetch customers   | `useQuery({ queryKey: ['customers'], queryFn })` |
| Get customer      | `useQuery({ queryKey: ['customer', id] })`       |
| Add points        | `useMutation({ mutationFn: addPoints })`         |
| Create campaign   | `useMutation({ mutationFn: createCampaign })`    |
| Dashboard metrics | `useQuery({ queryKey: ['dashboard'] })`          |

### 9.2 WhatsApp Business API Integration

| Concern             | Detail                                                                |
| ------------------- | --------------------------------------------------------------------- |
| **Provider**        | Meta WhatsApp Business API (Cloud API) or approved BSP                |
| **Auth**            | Bearer token (stored encrypted in `api_key` table)                    |
| **Message Types**   | Template messages (pre-approved by Meta)                              |
| **Rate Limits**     | Tier-based (80/sec for standard, 1000/sec for high volume)            |
| **Status Webhooks** | `sent`, `delivered`, `read`, `failed` callbacks                       |
| **Proxy**           | All calls go through Next.js API routes (never expose keys to client) |

### 9.3 PassKit API Integration

| Concern          | Detail                                         |
| ---------------- | ---------------------------------------------- |
| **Provider**     | PassKit (passkit.com)                          |
| **Auth**         | API key + secret                               |
| **Operations**   | Create pass, update pass, void pass            |
| **Pass Type**    | Loyalty / Store Card                           |
| **Push Updates** | Automatic when pass fields are updated via API |
| **Proxy**        | All calls go through Next.js API routes        |

### 9.4 Email API Integration

| Concern           | Detail                                                   |
| ----------------- | -------------------------------------------------------- |
| **Provider**      | Resend or SendGrid (configurable per tenant)             |
| **Auth**          | API key (stored encrypted)                               |
| **Message Types** | Transactional (wallet card link) + Marketing (campaigns) |
| **Proxy**         | All calls go through Next.js API routes                  |

---

## 10. User Flows

### 10.1 Business Owner Onboarding

```
1. Owner visits landing page
2. Clicks "Get Started" / "Sign Up"
3. Enters: email, password, business name
4. Email verification (Supabase Auth built-in email confirmation)
5. Redirected to onboarding wizard:
   a. Upload logo (optional, skip allowed)
   b. Set brand colors (optional, defaults provided)
   c. Connect WhatsApp API (optional, can do later)
   d. Connect PassKit API (optional, can do later)
6. Dashboard loads with empty state + getting started guide
```

### 10.2 Employee Onboarding

```
1. Owner goes to Settings → Team → Invite Employee
2. Owner enters employee email OR generates invite link
3. Employee receives email/link
4. Employee creates account (email + password)
5. Employee is assigned to tenant with "employee" role
6. Employee sees the tablet interface on login
```

### 10.3 Customer Check-In (Employee Flow)

```
1. Employee opens tablet interface
2. Types customer name/phone OR taps "Scan QR"
3. (If scan) Camera opens → scans QR → customer found
4. (If search) Types query → selects from results
5. Customer profile card appears (name, balance, last transactions)
6. Employee taps "+ Add Points"
7. Enters point amount + optional note
8. Confirmation dialog: "Add 10 points to Layla Hassan?"
9. Employee confirms
10. Transaction recorded, balance updated
11. Wallet card push update triggered (background)
12. Success toast: "10 points added. New balance: 255"
```

### 10.4 New Customer Registration (Employee Flow)

```
1. Employee taps "+ New Customer"
2. Enters: name, phone number, email (optional)
3. Taps "Register"
4. System creates customer record
5. System generates QR code
6. System triggers wallet card creation (background)
7. Customer profile card appears
8. Employee can immediately add points
9. (Background) Customer receives WhatsApp with wallet card link
```

### 10.5 Campaign Creation (Owner Flow)

```
1. Owner clicks "+ New Campaign" from dashboard
2. Enters campaign name
3. Selects channel: WhatsApp or Email
4. Writes message template (with variable picker: {{name}}, {{points}})
5. Previews rendered message
6. Selects audience:
   a. All customers
   b. A saved segment
   c. Manual selection (search + checkbox)
7. Reviews summary: "Send to 200 customers via WhatsApp"
8. Clicks "Send Now" or "Schedule"
9. Campaign begins sending (queued)
10. Owner can monitor progress on campaign detail page
```

### 10.6 Customer Wallet Card Journey

```
1. Customer is registered at the business
2. Receives WhatsApp message: "Welcome to {Business}! Save your loyalty card: {link}"
3. Customer taps link → prompted to add to Apple/Google Wallet
4. Card appears in wallet with: business logo, name, points balance, QR code
5. On next visit, customer opens wallet → shows QR to employee
6. Employee scans QR → customer profile loads
7. Points added → card updates automatically (push notification on phone)
```

---

## 11. UI/UX Requirements

### 11.1 Design Principles

1. **Speed over aesthetics** — every interaction should feel instant
2. **Clarity over cleverness** — obvious UI > innovative UI
3. **Touch-first** — designed for fingers, not cursors
4. **Minimal cognitive load** — employees should not need training
5. **RTL-ready** — all layouts must work in both LTR and RTL directions

### 11.2 Design System Basics

| Element               | Specification                                    |
| --------------------- | ------------------------------------------------ |
| **Typography**        | Inter (LTR), IBM Plex Sans Arabic (RTL)          |
| **Primary Font Size** | 16px base                                        |
| **Touch Target**      | Minimum 44×44px                                  |
| **Spacing Scale**     | 4px base (4, 8, 12, 16, 24, 32, 48, 64)          |
| **Border Radius**     | 8px (cards), 6px (inputs), 9999px (pills/badges) |
| **Shadows**           | Subtle elevation (0 1px 3px rgba(0,0,0,0.1))     |
| **Colors**            | Tenant-configurable primary + system neutrals    |

### 11.3 Responsive Breakpoints

| Breakpoint | Width    | Target              |
| ---------- | -------- | ------------------- |
| `sm`       | ≥ 640px  | Large phones        |
| `md`       | ≥ 768px  | Tablets (portrait)  |
| `lg`       | ≥ 1024px | Tablets (landscape) |
| `xl`       | ≥ 1280px | Desktops            |

### 11.4 RTL Support

- Use CSS logical properties (`margin-inline-start` instead of `margin-left`)
- Tailwind RTL plugin for directional utilities
- Store language preference in tenant settings
- All icons with directional meaning must flip in RTL mode
- Text alignment follows document direction

### 11.5 Loading & Empty States

Every screen must define:

- **Loading state** — skeleton placeholder matching the layout shape
- **Empty state** — friendly illustration + descriptive text + primary CTA
- **Error state** — clear error message + retry action

### 11.6 Internationalization (i18n)

| Requirement                 | Implementation                                                   |
| --------------------------- | ---------------------------------------------------------------- |
| **Library**                 | next-intl (integrated with Next.js App Router)                   |
| **Supported languages**     | English (default), Arabic                                        |
| **Translation approach**    | JSON message files (`lib/i18n/messages/en.json`, `ar.json`)      |
| **RTL handling**            | Automatic `dir="rtl"` on `<html>` when locale is Arabic          |
| **Language switching**      | Stored in tenant settings; applies to all users of that tenant   |
| **Date/number formatting**  | Locale-aware via `Intl` APIs (through next-intl)                 |
| **Tenant-facing strings**   | All UI text externalized to message files — no hardcoded strings |
| **Customer-facing strings** | Campaign templates are user-authored (not translated by the app) |

---

## 12. Security Requirements

### 12.1 Authentication Security

| Requirement                                  | Implementation                                |
| -------------------------------------------- | --------------------------------------------- |
| Passwords hashed with bcrypt/argon2          | Supabase Auth (bcrypt by default)             |
| JWT + refresh token auth with secure cookies | Supabase Auth via @supabase/ssr               |
| Rate limiting on auth endpoints              | Supabase Auth built-in + Upstash rate limiter |
| Email verification required before access    | Supabase Auth email confirmation              |
| CSRF protection                              | SameSite cookies + CSRF token validation      |

### 12.2 Data Security

| Requirement                                    | Implementation                                |
| ---------------------------------------------- | --------------------------------------------- |
| Row-Level Security on all tenant-scoped tables | Postgres RLS policies + Drizzle query scoping |
| API keys encrypted at rest (AES-256)           | pgcrypto or application-level encryption      |
| API keys never sent to client                  | Next.js API routes only                       |
| HTTPS enforced on all connections              | Vercel + Supabase defaults                    |
| Input validation on all user inputs            | Zod schemas (client + Next.js API routes)     |
| SQL injection prevention                       | Drizzle ORM parameterized queries             |
| XSS prevention                                 | React's default escaping + CSP headers        |

### 12.3 Data Privacy

| Requirement                             | Implementation                                  |
| --------------------------------------- | ----------------------------------------------- |
| Customer phone numbers stored securely  | Not exposed in URLs or logs                     |
| Opt-out mechanism for messaging         | Unsubscribe flag on customer record             |
| Data deletion on tenant account removal | Cascade soft-delete + hard delete after 30 days |
| No cross-tenant data access possible    | RLS + application-level checks                  |
| Audit log for sensitive operations      | Log table for key actions                       |

### 12.4 Content Security Policy

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' https://*.supabase.co data:;
connect-src 'self' https://*.supabase.co;
font-src 'self';
frame-ancestors 'none';
```

---

## 13. Milestones & Delivery Plan

### Milestone 1: Setup + Auth + Database

**Objective:** Foundation is built — project scaffolded, auth working, database schema deployed, RLS policies active.

| Deliverable                         | Details                                                      |
| ----------------------------------- | ------------------------------------------------------------ |
| Project scaffolding                 | Next.js 14+ (App Router) + TypeScript + Tailwind + shadcn/ui |
| Supabase CLI local dev setup        | `supabase init`, local Postgres, Storage, Auth, Studio       |
| Drizzle ORM setup                   | Schema definitions, migrations, Drizzle Kit config           |
| Database schema migration           | All core tables created with indexes via Drizzle migrate     |
| RLS policies                        | Policies on all tenant-scoped tables                         |
| Supabase Auth setup                 | Email/password auth, JWT session, @supabase/ssr              |
| Auth flows                          | Sign up, sign in, sign out, password reset                   |
| Tenant creation on sign-up          | Auto-create tenant + assign owner role                       |
| TanStack Query + Zustand setup      | Query client config, Zustand stores                          |
| Route guards                        | Next.js middleware + layout-level auth checks                |
| PWA manifest + basic service worker | Installable shell                                            |

**Exit Criteria:**

- [ ] New user can sign up and a tenant + owner record is created
- [ ] Signed-in user can only see their own tenant's data
- [ ] RLS policies tested with multiple test tenants
- [ ] Drizzle migrations run cleanly against Supabase CLI local Postgres and production Supabase
- [ ] Supabase Auth sign-in, sign-up, and password reset work end-to-end
- [ ] Employee invite flow works end-to-end
- [ ] App is installable as PWA on iPad

---

### Milestone 2: Customer + Employee Flow

**Objective:** Core operational loop is functional — employees can find customers, add/deduct points, and register new customers.

| Deliverable                    | Details                                         |
| ------------------------------ | ----------------------------------------------- |
| Employee tablet interface      | Full layout as specified in §5.3                |
| Customer search (name + phone) | < 500ms results with debounced input            |
| QR code scanning               | Camera-based scan → customer lookup             |
| Customer profile card          | Display name, phone, balance, last transactions |
| Add/deduct points              | With confirmation dialog, reason/note field     |
| Transaction recording          | Atomic: update balance + insert transaction     |
| New customer registration      | Inline form → creates record + generates QR     |
| QR code generation             | Unique QR per customer                          |

**Exit Criteria:**

- [ ] Employee can search and find a customer in < 500ms
- [ ] Employee can scan a QR code and load the customer profile
- [ ] Points can be added/deducted with atomic transaction recording
- [ ] New customer can be registered and immediately interacted with
- [ ] All operations are tenant-scoped (verified via RLS)

---

### Milestone 3: Dashboard + CRM

**Objective:** Owner has a functional dashboard with customer management capabilities.

| Deliverable             | Details                                     |
| ----------------------- | ------------------------------------------- |
| Dashboard layout        | As specified in §5.6                        |
| Metric cards            | Total customers, active, new, messages sent |
| Customer list view      | Search, filter, sort, pagination            |
| Customer detail view    | Full profile + transaction history          |
| Customer tagging        | Add/remove tags for segmentation            |
| Basic segments          | Save filter criteria as named segments      |
| Charts (if P2 in scope) | New customers trend, points activity        |

**Exit Criteria:**

- [ ] Dashboard loads with accurate metrics in < 2 seconds
- [ ] Customer list supports search, filter by tag/points/date, and sort
- [ ] Individual customer view shows complete transaction history
- [ ] Segments can be created, saved, and used to filter the customer list
- [ ] All data is tenant-scoped

---

### Milestone 4: Messaging Integration

**Objective:** Owner can create and send campaigns via WhatsApp and email.

| Deliverable                | Details                                        |
| -------------------------- | ---------------------------------------------- |
| Campaign creation UI       | Name, channel, template, audience selection    |
| Template editor            | Text input with variable insertion             |
| Audience selector          | All / segment / manual selection               |
| Message sending (WhatsApp) | Via Next.js API route → WhatsApp API           |
| Message sending (Email)    | Via Next.js API route → Email API              |
| Message queue              | Rate-limited batch processing                  |
| Delivery tracking          | Webhook processing for status updates          |
| Campaign history + stats   | List campaigns with aggregate delivery metrics |

**Exit Criteria:**

- [ ] Owner can create a campaign and send to a segment via WhatsApp
- [ ] Messages are delivered with correct variable substitution
- [ ] Delivery status updates are received and displayed
- [ ] Rate limits are respected (no API bans)
- [ ] Campaign stats are accurate and tenant-scoped
- [ ] Email sending works as a secondary channel

---

### Milestone 5: Wallet Integration

**Objective:** Customers receive digital loyalty cards that update when points change.

| Deliverable                          | Details                                           |
| ------------------------------------ | ------------------------------------------------- |
| PassKit integration                  | Next.js API route to create/update passes         |
| Wallet card template                 | Branded card with business logo, name, QR, points |
| Card creation on registration        | Triggered automatically                           |
| Card delivery                        | Download link sent via WhatsApp/email             |
| Balance push updates                 | API route call post-transaction → PassKit update  |
| Apple Wallet + Google Wallet support | Both formats generated                            |

**Exit Criteria:**

- [ ] New customer registration triggers wallet card creation
- [ ] Card displays correct business branding and customer info
- [ ] Card can be added to Apple Wallet and Google Wallet
- [ ] Points change triggers a push update to the card
- [ ] QR code on card can be scanned by employee interface

---

### Milestone 6: PWA + Testing + Deployment

**Objective:** Application is production-ready, tested, and deployed.

| Deliverable                 | Details                                               |
| --------------------------- | ----------------------------------------------------- |
| PWA optimization            | Service worker caching, offline fallback              |
| RTL support                 | Full RTL layout testing and fixes                     |
| Cross-browser testing       | Chrome, Safari, Edge on tablet + desktop              |
| Security audit              | RLS policy review, API key handling, input validation |
| Performance optimization    | Bundle splitting, image optimization, caching         |
| Production deployment       | Vercel production environment                         |
| Supabase production setup   | Hosted Postgres project, Storage, Auth, migration run |
| Supabase CLI local dev docs | README for local dev setup with `supabase start`      |
| Documentation               | Setup guide, API docs, deployment runbook             |

**Exit Criteria:**

- [ ] App scores ≥ 90 on Lighthouse (Performance, Accessibility, Best Practices, PWA)
- [ ] All features work correctly in RTL mode
- [ ] No P0 bugs remaining
- [ ] Load tested with simulated concurrent users
- [ ] Production environment operational with monitoring
- [ ] Documentation complete

---

## 14. Acceptance Criteria

### Global Acceptance Criteria (All Features)

1. **Tenant Isolation** — No feature ever exposes data from another tenant
2. **Role Enforcement** — Employee cannot access owner-only features
3. **Responsive** — All screens work on 768px+ viewports
4. **RTL** — All screens render correctly in RTL mode
5. **Performance** — No screen takes > 3 seconds to become interactive
6. **Error Handling** — All API failures show user-friendly error messages
7. **Loading States** — All async operations show appropriate loading indicators
8. **Accessibility** — WCAG 2.1 AA compliance for all interactive elements

### Feature-Specific Acceptance Criteria

| Feature               | Key Acceptance Criteria                                                       |
| --------------------- | ----------------------------------------------------------------------------- |
| Sign Up               | Creates tenant + user, sends verification email, blocks access until verified |
| Employee Interface    | Full workflow (search → view → add points → confirm) in under 15 seconds      |
| QR Scan               | Scans and resolves customer in < 3 seconds on iPad                            |
| Customer Registration | Creates record, generates QR, optional wallet card in < 5 seconds             |
| Dashboard             | All metrics accurate and matching raw data in DB                              |
| Campaign Send         | 100% of audience receives message (retry on failure), status tracking works   |
| Wallet Card           | Installable on iOS 16+ and Android 12+, balance updates within 60 seconds     |
| Settings              | API keys are encrypted, never shown in plain text after initial save          |

---

## 15. Risks & Mitigations

| #   | Risk                                              | Impact   | Likelihood | Mitigation                                                             |
| --- | ------------------------------------------------- | -------- | ---------- | ---------------------------------------------------------------------- |
| 1   | WhatsApp API approval delays                      | High     | Medium     | Start approval process early; build with sandbox; email as fallback    |
| 2   | PassKit API limitations or pricing changes        | Medium   | Low        | Abstract wallet integration behind an interface; evaluate alternatives |
| 3   | Supabase RLS misconfiguration leaks data          | Critical | Low        | Automated RLS tests; security review at each milestone                 |
| 4   | Camera API inconsistencies across devices         | Medium   | Medium     | Test on multiple devices early; fallback to manual search              |
| 5   | WhatsApp rate limiting during large campaigns     | Medium   | High       | Robust queue with exponential backoff; batch size limits               |
| 6   | PWA limitations on iOS (Safari restrictions)      | Low      | Medium     | Test on iOS early; document known limitations                          |
| 7   | RTL layout bugs                                   | Medium   | Medium     | Use CSS logical properties from day one; RTL testing in CI             |
| 8   | Performance degradation with large customer lists | Medium   | Medium     | Pagination, virtual scrolling, DB indexes, query optimization          |
| 9   | Third-party API downtime                          | Medium   | Low        | Queue + retry pattern; graceful degradation; status indicators         |
| 10  | GDPR / data privacy compliance gaps               | High     | Medium     | Data deletion flows; consent tracking; privacy policy                  |

---

## 16. Glossary

| Term               | Definition                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| **Tenant**         | A business/organization using the platform; all data is scoped to a tenant                       |
| **Owner**          | The business owner who administers the platform; has full access                                 |
| **Employee**       | A staff member who uses the tablet interface to manage customer interactions                     |
| **Customer**       | An end customer of the business who earns/redeems points                                         |
| **Points**         | The loyalty currency unit; can be configured per tenant (stars, credits, etc.)                   |
| **Transaction**    | A credit or debit of points on a customer's balance                                              |
| **Campaign**       | A batch message sent to a group of customers via WhatsApp or email                               |
| **Segment**        | A saved set of filter criteria that defines a group of customers                                 |
| **Wallet Card**    | A digital loyalty card stored in Apple Wallet or Google Wallet                                   |
| **RLS**            | Row-Level Security — PostgreSQL feature that restricts data access at the row level              |
| **PWA**            | Progressive Web App — a web app that can be installed and run like a native app                  |
| **RTL**            | Right-to-Left — text direction for languages like Arabic and Hebrew                              |
| **Edge Function**  | A serverless function running on Supabase's Deno runtime (used only for webhook-whatsapp)        |
| **PassKit**        | Third-party service for creating and managing digital wallet passes                              |
| **Drizzle ORM**    | TypeScript-first ORM with declarative schema and type-safe query builder                         |
| **Better Auth**    | _(Removed)_ — replaced by Supabase Auth (GoTrue)                                                 |
| **Supabase Auth**  | GoTrue-based authentication built into Supabase; provides JWT sessions, email/pass, social login |
| **shadcn/ui**      | A collection of re-usable UI components built on Radix primitives and Tailwind CSS               |
| **TanStack Query** | Async state management library for data fetching, caching, and synchronization                   |
| **Zustand**        | Lightweight client state management library for React                                            |
| **Next.js**        | Full-stack React framework with App Router, API routes, and SSR/SSG support                      |
| **Upstash Redis**  | Serverless Redis service used for API rate limiting                                              |
| **next-intl**      | Internationalization library for Next.js supporting RTL and message-based translations           |
| **Docker**         | Container platform used by Supabase CLI to run the local development stack                       |

---

## 17. Extra Features

The following features are planned enhancements for future releases. They are not included in the v1.0 scope but represent the product roadmap and strategic direction for operator efficiency and system resilience.

### 17.1 Real-Time Queue Status Polling via WebSocket

**Description:**
Live WebSocket-based updates for queue processing status, allowing operators to monitor messaging campaign queue progression without manual page refreshes.

**Scope:**

- Establish WebSocket connection from campaign detail page to `/api/ws/queue-status/{campaignId}`
- Stream real-time updates: messages processed, sent, failed, deferred counts + completion percentage
- Visual progress bar showing queue processing advancement
- Live badge updates (queue counts, ETA, recovery status) without full page refresh
- Connection management: auto-reconnect on network loss, graceful disconnect

**Benefits:**

- Operators get immediate feedback on manual queue processing actions
- Reduces perceived latency — no need to wait or manually refresh
- Enables monitoring of background/long-running queue operations
- Better visibility into high-traffic campaign sends

**Technical Approach:**

- Use Next.js API routes with `ws` library for WebSocket support
- Emit events from queue processor to all connected clients for given campaign
- Client-side: React useEffect subscript to WebSocket, setState on message
- Fallback: polling with 5-second intervals if WebSocket unavailable

---

### 17.2 Provider Rate-Limit Documentation & Inline Help

**Description:**
In-app contextual documentation and links explaining provider-specific retry schedules, rate limits, and recovery windows.

**Scope:**

- Info icons (?) next to "Rate-limited" badge in campaign history — hover shows provider retry schedule
- Provider-specific rate-limit thresholds: WhatsApp (80/sec), SMS/Infobip (50/min), Email (unlimited/generous)
- Recovery window estimates: "Queue will resume sending in ~2h 15m" based on calculated ETA
- Help center articles embedded or linked: Why rate limits occur, what to do, how Kinecto handles them
- Settings > Documentation tab with full provider docs (link to official whatsapp.com/business/docs for whatsapp, etc.)

**Benefits:**

- Educates operators on why queues pause
- Sets correct expectations for message delivery timing
- Reduces support burden — self-serve answers
- Builds trust through transparency

**Technical Approach:**

- Add `<Tooltip>` component from shadcn/ui over rate-limit badge
- Create constants file with provider policies (base rate, window, recovery time)
- Use i18n (next-intl) for multi-language documentation
- Link to external provider docs (https://developers.whatsapp.com/docs/whatsapp/rate-limits)

---

### 17.3 Automatic Queue Recovery When Rate-Limit Window Passes

**Description:**
The system automatically retries deferred messages when the rate-limit recovery window elapses, without requiring manual operator intervention.

**Scope:**

- Background cron job (or edge function) runs every 30 seconds: fetch all campaigns with `lastQueueRun.rateLimited=true` and `nextRetryAt <= now`
- Invoke `/api/messaging/process-queue` with campaign-scoped flag
- Update campaign's `lastQueueRun` with new results
- Emit WebSocket event to notify any watching operators of recovery attempt
- Log recovery attempts for audit trail (timestamps, result)

**Benefits:**

- Queues recover automatically without manual restart
- Operators don't need to babysit paused queues
- Messages are sent faster overall (no human reaction time)
- Improves customer experience (promotions/alerts delivered timely)
- Better SLA — near 100% eventual delivery

**Technical Approach:**

- Use Supabase Edge Functions (cron trigger) or Vercel Cron (every 30 seconds)
- Query: `SELECT * FROM campaign WHERE lastQueueRun->'rateLimited' = true AND (lastQueueRun->'nextRetryAt')::timestamp <= now()`
- For each, POST to `/api/messaging/process-queue` with `campaignId` + internal auth (JWT or job secret)
- Track recovery in campaign_recovery_logs table: campaignId, attemptedAt, result (success/partialFail/failed)

**Example Flow:**

1. Operator sends campaign at 2:00 PM — WhatsApp responds with 429 (rate-limited)
2. Queue paused, `nextRetryAt` = 2:15 PM (15-minute backoff window)
3. At 2:15:05 PM, cron job detects recovery window passed
4. Automatically calls queue processor — WhatsApp now accepts messages
5. Queue resumes: 50 messages sent, campaign marked as fully processed
6. Operator sees green checkmark in history, "Queue auto-recovered at 2:15 PM"

**Release Criteria:**

- Cron/edge function runs reliably without missing windows
- Recovery rate > 95% (messages retry successfully after rate-limit recovery)
- UI clearly indicates auto-recovery (timestamp in lastQueueRun, badge change)
- Zero false positives (don't retry permanently failed messages)

---

## 18. Appendices

### Appendix A: Environment Variables

```env
# Database (Local — Supabase CLI)
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Supabase (Local — provided by `supabase start`)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJhbGciOi...  # local anon key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...  # local service role key

# App
NEXT_PUBLIC_APP_URL=https://app.kinecto.com
NEXT_PUBLIC_APP_NAME=Kinecto
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Feature Flags (optional)
NEXT_PUBLIC_ENABLE_EMAIL=true
NEXT_PUBLIC_ENABLE_WALLET=true
```

**Server-Side Secrets (never exposed to client):**

```
DATABASE_URL
SUPABASE_SERVICE_ROLE_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
WHATSAPP_API_URL
WHATSAPP_API_TOKEN
PASSKIT_API_KEY
PASSKIT_API_SECRET
EMAIL_API_KEY
```

### Appendix A.1: Supabase CLI Local Development

```bash
# One-time project initialization
npx supabase init

# Start the full local Supabase stack (Postgres, Auth, Storage, Studio)
npx supabase start

# Local service URLs (output by `supabase start`):
#   API URL:      http://localhost:54321
#   GraphQL URL:  http://localhost:54321/graphql/v1
#   DB URL:       postgresql://postgres:postgres@localhost:54322/postgres
#   Studio URL:   http://localhost:54323
#   Anon key:     eyJhbGciOi...
#   Service key:  eyJhbGciOi...

# Run Drizzle migrations against local Postgres
npx drizzle-kit push

# Deploy Edge Functions locally (webhook-whatsapp only)
npx supabase functions serve

# Stop local stack
npx supabase stop
```

### Appendix B: Drizzle ORM Schema Example

```typescript
// server/db/schema/customer.ts
import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { tenants } from "./tenant";

export const customers = pgTable("customer", {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
        .notNull()
        .references(() => tenants.id),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    pointsBalance: integer("points_balance").default(0).notNull(),
    tags: text("tags").array(),
    notes: text("notes"),
    qrCodeUrl: text("qr_code_url"),
    walletPassId: text("wallet_pass_id"),
    status: text("status", { enum: ["active", "inactive"] })
        .default("active")
        .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    lastVisitAt: timestamp("last_visit_at"),
});
```

### Appendix B.1: RLS Policy Pattern (Database Level)

```sql
-- RLS policies still apply at the Postgres level as defense-in-depth
ALTER TABLE customer ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY "tenant_isolation" ON customer
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- Insert policy
CREATE POLICY "tenant_insert" ON customer
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::UUID);

-- Set tenant context from API route before queries
-- SET LOCAL app.tenant_id = '<tenant-uuid>';
```

### Appendix C: Transaction Atomicity Pattern (Drizzle ORM)

```typescript
// server/api/transactions.ts
import { db } from "../db";
import { customers, transactions } from "../db/schema";
import { eq, and } from "drizzle-orm";

export async function createTransaction(
    tenantId: string,
    customerId: string,
    type: "credit" | "debit",
    amount: number,
    performedBy: string,
    note?: string
) {
    return await db.transaction(async (tx) => {
        // Lock and fetch current balance
        const [customer] = await tx
            .select({ pointsBalance: customers.pointsBalance })
            .from(customers)
            .where(
                and(
                    eq(customers.id, customerId),
                    eq(customers.tenantId, tenantId)
                )
            )
            .for("update");

        if (!customer) throw new Error("Customer not found");

        const newBalance =
            type === "credit"
                ? customer.pointsBalance + amount
                : customer.pointsBalance - amount;

        if (newBalance < 0) throw new Error("Insufficient balance");

        // Update balance
        await tx
            .update(customers)
            .set({
                pointsBalance: newBalance,
                updatedAt: new Date(),
                lastVisitAt: new Date(),
            })
            .where(
                and(
                    eq(customers.id, customerId),
                    eq(customers.tenantId, tenantId)
                )
            );

        // Insert transaction record
        const [transaction] = await tx
            .insert(transactions)
            .values({
                tenantId,
                customerId,
                type,
                amount,
                balanceAfter: newBalance,
                note,
                performedBy,
            })
            .returning({ id: transactions.id });

        return { transactionId: transaction.id, newBalance };
    });
}
```

### Appendix D: Deployment Checklist

- [ ] Supabase production project created (Postgres + Storage + Auth)
- [ ] All Drizzle migrations applied to production database
- [ ] RLS policies verified with cross-tenant test cases
- [ ] WhatsApp webhook Edge Function deployed
- [ ] Environment variables set in Vercel (including DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- [ ] Custom domain configured (DNS + SSL)
- [ ] Supabase Auth production redirect URLs configured
- [ ] WhatsApp Business API approved and webhook URL configured
- [ ] PassKit templates created for production
- [ ] Email domain verified with email API provider
- [ ] Supabase Auth email templates customized
- [ ] Service worker tested (install + cache + update)
- [ ] Lighthouse scores acceptable (≥ 90 all categories)
- [ ] Error monitoring service connected (e.g., Sentry)
- [ ] Database backups verified
- [ ] Rate limiting configured on API routes and Edge Functions
- [ ] Supabase CLI local dev setup documented in README

---

_End of PRD — Kinecto v1.0_
