# Commercial Visits Management PWA

## Overview

This Progressive Web Application (PWA) facilitates commercial visit management for field sales professionals targeting architecture offices (gabinetes) and other entities. It enables efficient tracking of entities, contacts, and visits, incorporating features like audio transcription, AI-powered visit summaries, automated email notifications, geolocation capture, calendar integration, PDF export, and comprehensive analytics. The application is built as a full-stack TypeScript solution with a React frontend, Express backend, and PostgreSQL with Drizzle ORM, emphasizing mobile-first design, Material Design principles, and robust user data security through isolation and Role-Based Access Control (RBAC). The project aims to provide a comprehensive tool for sales teams to streamline their operations, enhance data quality, and gain actionable insights.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is a mobile-first React 18 application built with TypeScript, utilizing Wouter for routing and Vite for development and bundling. It employs Shadcn/ui (New York style) with Radix UI primitives and Tailwind CSS for styling, adhering to Material Design principles. State management is handled by TanStack React Query for server state and React Hook Form with Zod for form validation. Key UI patterns include card-based layouts, search-first interfaces, and Floating Action Buttons (FABs).

### Backend Architecture

The backend is an Express.js application written in TypeScript. It uses session-based authentication with Replit Auth (OpenID Connect) and Passport.js, storing sessions in PostgreSQL. API endpoints are RESTful, covering authentication, universal entities (`/api/entidades`), contacts, visits (including file uploads), tasks, and analytics. Multer handles file uploads (audio/images) with temporary storage. A robust RBAC system differentiates between Admin (all data access) and Agent (owner/assigned data access) roles, enforcing ownership checks for all data operations.

### Database Architecture

The database uses PostgreSQL with Drizzle ORM for type-safe schema management. The core data model includes:
- **Users**: Authentication and profile information, integrated with Replit Auth.
- **Entidades**: A universal entity system replacing legacy "Gabinetes," supporting types like Gabinete, Cliente, Distribuidor, Obra, Parceiro, Outro, with fields for NIF, address, and GPS coordinates.
- **Contactos**: Contacts linked to entities.
- **Visitas**: Visit records with dates, notes, media attachments, audio transcriptions, AI summaries, and geolocation.
- **Tarefas**: A comprehensive task management system with status, repeat intervals, and optional links to entities/visits.
- **Lembretes**: Intelligent reminder system tracking three types: visit follow-ups (7 days after last visit), overdue tasks, and AI-suggested reminders. Fully RBAC-aware with watertight security.
- **Marcas**: Product brands.
- **Sessions**: For authentication state.
Relationships are managed via foreign keys, and data integrity is maintained with timestamp tracking and JSONB fields for flexible data storage.

### System Design Choices

- **Offline Capabilities**: Comprehensive offline support with IndexedDB for data caching and storage. Automatic synchronization of created entities, contacts, and tasks when online. Query caching allows offline access to previously fetched data.
- **Geolocation Integration**: Automatic GPS capture during visit creation, displayed with map links.
- **Calendar Integration**: Backend-generated, RFC 5545 compliant `.ics` files for visits and tasks, including detailed event data, deep links, and reminders.
- **PDF Export**: Backend-generated PDF reports for visits, including logos, embedded photos, AI summaries, and linked tasks, with smart pagination.
- **Advanced Analytics**: RBAC-aware analytics dashboard providing key performance indicators (KPIs) and visualizations for visits, tasks, entities, and brands, with filtering capabilities.
- **Multi-Agent System with RBAC**: Granular control over data access based on user roles (Admin/Agent), ensuring agents only access their owned or assigned data across entities, contacts, visits, and tasks.
- **Universal Entidades System**: Migration from a "Gabinetes"-only model to a flexible "Entidades" system supporting various business entity types.
- **Universal Contact Recognition Module**: Comprehensive contact import system with three methods:
  1. **QR Code Scanner**: Scans QR codes containing vCard data
  2. **vCard Parser**: Imports .vcf files with full vCard 3.0/4.0 support
  3. **Business Card Vision Scanner**: AI-powered extraction from business card photos using OpenAI gpt-4o vision API
  All three methods utilize universal auto-creation logic that intelligently matches or creates entities based on organization name and domain, with full RBAC enforcement and offline queue support.
- **Google Custom Search Enrichment Module**: Company enrichment system using Google Custom Search API with AI-powered data extraction:
  1. **Fuzzy Match Engine**: Multi-algorithm matching against local database using weighted scoring: 50% Jaro-Winkler (sequential similarity), 30% Damerau-Levenshtein with transpositions (edit distance), 20% Metaphone-PT (Portuguese phonetic matching). Threshold ≥0.60 for matches.
  2. **Google Custom Search**: When no local fuzzy matches found, triggers Google Custom Search API (for Gabinete, Distribuidor, Parceiro, Construtor types only) with caching (24h TTL), rate limiting (20 req/min, 200/day), and spend logging.
  3. **GPT Data Extraction**: Uses GPT-4o-mini to extract structured company data from search results (nome, telefone, morada, email, website, cidade) with confidence scoring and source URL attribution.
  Endpoint: `POST /api/enrichment/pt-intelligent-search` with full RBAC enforcement and tipoEntidade validation (blocks "Contato Pessoal"). Returns `PTEnrichmentResult` with `fuzzyMatches[]`, `googleResults[]`, and `enrichmentSource` ('fuzzy', 'google', 'disabled', 'none'). Frontend integration via `GoogleCompanySearch` component with debounced suggestions, source URL visibility, mandatory user confirmation before data persistence, and `fillEntityForm` utility for universal auto-fill. Includes comprehensive offline queue support. Legacy IA-Normalizer and PT-WebScan completely disabled (were generating hallucinated data).
- **Intelligent Reminder System**: Proactive reminder engine generating three types of notifications:
  1. **Visit Follow-ups**: Automatically suggests follow-up visits 7 days after the last visit to an entity
  2. **Overdue Tasks**: Alerts users about pending tasks past their due date
  3. **AI-Suggested Reminders**: Future capability for intelligent reminder suggestions
  Reminders are RBAC-aware with watertight security - agents see only reminders for their assigned entities and tasks. Features include snooze (1, 3, 7 days), resolve, and reminder banners integrated into entity and visit detail pages. Real-time badge counts in navigation bell icon.
- **Microsoft 365 Integration Module (Admin-Only)**: Seamless integration with Microsoft 365 services for task and visit export:
  1. **OAuth 2.0 Authentication**: Secure OAuth flow with state validation and encrypted token storage in `microsoft_tokens` table. Automatic token refresh via Microsoft Graph API client.
  2. **Microsoft Planner Export**: Export tasks to Planner with full group/plan/bucket selection, automatic assignment, and bidirectional sync tracking (`plannerTaskId`, `lastPlannerSyncAt` fields).
  3. **Microsoft To-Do Export**: One-click task creation in To-Do with categories, due dates, and deep links back to the PWA.
  4. **Outlook Calendar Export**: Create calendar events for visits with AI summaries, location data, automatic reminders, and sync tracking (`outlookEventId`, `lastCalendarSyncAt` fields).
  5. **RBAC Enforcement**: All Microsoft integration endpoints (auth, data retrieval, export) enforce admin-only access with 403 responses for agents. Tokens are user-specific and isolated per admin account.
  6. **Frontend Integration Page**: Accessible at `/integracoes/microsoft` with connection status, scopes display, connect/disconnect functionality, and feature overview. Linked prominently from Dashboard.
  Features full RBAC enforcement, comprehensive error handling, and follows OAuth 2.0 best practices with encrypted credential storage.
- **PRO Exports Module**: Advanced PDF generation system with comprehensive analytics, charts, and AI-powered summaries:
  1. **Visit PDF PRO Export**: Detailed visit reports with embedded photos, AI summaries, linked tasks, GPS coordinates with map links, and optional performance charts. Accessible via `/api/pdf/visita/:id/pro` with query params for options (includePhotos, includeTasks, includeIA, includeCharts). Frontend dialog in VisitaDetail page.
  2. **Entity PDF PRO Export**: Complete entity history reports including all visits, contact list, task summary, visit frequency charts, brand distribution analytics, and AI-powered executive summaries. Accessible via `/api/pdf/entidade/:id/pro`. Frontend dialog in EntidadeDetail page.
  3. **Periodic Reports (Monthly/Weekly)**: Agent-specific and company-wide (admin-only) performance reports with KPI metrics, visit trends, task completion rates, brand analytics, and AI-generated insights. Endpoints: `/api/pdf/reports/monthly` and `/api/pdf/reports/weekly` with `scope` param (agent/company). Frontend buttons in Dashboard Reports section.
  4. **Chart Rendering**: Server-side chart generation using chartjs-node-canvas for embedding bar charts, line charts, and pie charts in PDFs. Supports visit frequency analysis, brand distribution, and task completion metrics.
  5. **AI-Powered Summaries**: Professional Portuguese (PT-PT) executive summaries generated via OpenAI GPT-4o-mini, providing actionable insights and key highlights for each report type.
  6. **RBAC Enforcement**: SQL-level filtering ensures agents access only their owned/assigned data; admins access all data. Company-wide reports restricted to admin role.
  7. **Frontend Implementation**: PDF PRO buttons with dialogs in VisitaDetail, EntidadeDetail, and Dashboard pages. Options include toggles for photos, tasks, AI summaries, charts, and report type selection.
  Features comprehensive error handling, graceful degradation for missing data, smart pagination for large reports, and offline usage guards.

## External Dependencies

- **Neon Database**: Serverless PostgreSQL hosting for production data persistence.
- **OpenAI API**: Utilized for AI-powered features, including Whisper for audio transcription and GPT for visit summary generation.
- **Replit Authentication**: OAuth/OIDC provider for user authentication and profile management.
- **Email Integration**: Prepared for services like Resend or SendGrid for automated email notifications (currently console logging in development).
- **UI Component Dependencies**: Radix UI primitives, Lucide React for iconography, date-fns for date manipulation.