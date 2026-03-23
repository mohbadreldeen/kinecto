We’re building a loyalty and customer engagement platform for businesses like cafes, salons, and retail shops.

The platform allows businesses to:

Manage customers
Offer loyalty rewards
Send marketing messages (WhatsApp/email)
View key activity through a dashboard

We already have clear specs, UI mockups, and database structure, so the work is mainly implementation and integration.

Scope (Focused)

1. Multi-Tenant Setup
   Each business has its own account and data
   Basic branding (name, logo, colors)
   Secure data separation using Supabase
2. Employee Interface (Tablet-Friendly)
   Search or scan the customer (QR or phone)
   View profile (balance/points)
   Add or deduct credit
   Register new customers
3. Customer Management (CRM Basics)
   Store customer data (name, phone, points, activity)
   View simple transaction history
   Basic segmentation
4. Messaging (Basic Version)
   Send WhatsApp messages via API
   Optional email sending
   Basic targeting
   Simple delivery tracking
5. Dashboard (Essential Metrics)
   Total customers
   Active users
   Basic campaign stats
   Customer list with search/filter
6. Wallet Integration
   Generate digital loyalty card (Apple/Google Wallet via PassKit)
   Update balance when points change
7. Settings
   Manage API keys
   Basic roles (owner/employee)
8. PWA Setup (Light)
   Installable web app (add to home screen)
   Optimized for tablet use (employee side)
   Basic caching for faster load

Tech Stack
Frontend: React + TypeScript + Tailwind
Backend: Supabase (Postgres, Auth, RLS)
Hosting: Vercel
Integrations: PassKit, WhatsApp API, Email
PWA: Standard service worker setup
Milestones
Setup + Auth + Database —
Customer + Employee Flow —
Dashboard + CRM —
Messaging Integration —
Wallet Integration —
PWA + Testing + Deployment —

What We Provide :
UI mockups
Database schema
Feature breakdown
API access
Clear milestone expectations
Requirements :
Strong React + TypeScript experience
Experience with Supabase
API integration experience
Nice to Have :
SaaS or multi-tenant experience
PWA experience
RTL (Arabic UI) experience
