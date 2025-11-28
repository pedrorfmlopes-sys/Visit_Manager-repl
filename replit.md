# Commercial Visits Management PWA

## Overview
This Progressive Web Application (PWA) is designed to streamline commercial visit management for field sales professionals. It enables tracking of entities, contacts, and visits, offering AI-powered summaries, audio transcription, automated notifications, geolocation, calendar integration, PDF export, and advanced analytics. The primary goal is to enhance data quality and provide actionable insights to sales teams. It is a full-stack TypeScript solution featuring a React frontend, Express backend, and PostgreSQL with Drizzle ORM, built with a mobile-first, multi-tenant architecture, user data isolation, and Role-Based Access Control (RBAC).

## User Preferences
- Preferred communication style: Simple, everyday language.
- **MANDATORY: Create a detailed report (Resumo_*.md) after EVERY prompt/step until user says otherwise.**
- Follow prompts EXACTLY without adding extra features or "inventions"
- Always use test IDs and comprehensive documentation

## Recent Implementation (Nov 27, 2025)

### CRM Leads Module (Complete)
- ✅ Schema with 14 fields + 4 CRUD routes
- ✅ Admin UI: List page (/admin/leads) + Detail page (/admin/leads/:id) with inline editing
- ✅ User UI: "Leads desta entidade/contacto/visita" cards in detail pages
- ✅ Branding: Odoo logo (SVG) in 5 locations with state indicators (colored vs grayscale)
- ✅ Cache: Invalidates 5 query keys on update (list, detail, visita, entidade, contacto)
- ✅ Feature toggle: crmLeadsEnabled flag in empresa settings
- ✅ **FASE-LEADS-MANUAL-01**: Manual lead creation from /admin/leads with Entidade/Contacto selects
- ✅ **FASE-LEADS-ANEXOS-02**: Odoo attachments system (read + upload with 10MB validation)
- ✅ **FASE-LEADS-CLEAN-01**: Backend permissive - entidadeId OR contactoId (at least one required)
- ✅ **FASE-LEADS-CLEAN-02**: Frontend permissive - Entidade/Contacto both optional, at least one required
- ✅ **FASE-LEADS-CLEAN-03**: Conditional leads_contactos insert - only when contactoId exists
- ✅ **FASE-LEADS-FILTROS-01**: Backend search (q), filters (estado, hasOdoo), ordering (orderBy, orderDir), pagination (LIMIT 100)
- ✅ **FASE-LEADS-FILTROS-02**: Frontend UI with filters bar, URL query params sync, responsive design

### SS-01: Lightweight Search Endpoints (Complete)
- ✅ **FASE-SS-01**: 3 search endpoints (entidades, contactos, visitas) with max 20 results, RBAC respecting, TypeScript types

### SS-02: Generic SearchSelect Component (Complete)
- ✅ **FASE-SS-02**: Generic async search component with debounce 300ms, clear selection, loading/empty states, TypeScript types

### SS-03: CRM-Specific SearchSelect Wrappers (Complete)
- ✅ **FASE-SS-03**: 3 wrapper components (Entidade/Contacto/Visita) with endpoint integration and optional entidadeId filtering

### SS-04: Integration in Admin Leads Form (Complete)
- ✅ **FASE-SS-04**: Integrated SearchSelect wrappers into /admin/leads/new form, replaced traditional Selects with async search components, maintained validation and returnTo navigation

### FASE-LEADS-FILTROS-01: Search, Filters & Ordering (Complete)
- ✅ Fixed search input with debounce 300ms (local state + handleSearchChange)
- ✅ All filters (estado, entidade, contacto, hasOdoo) working with updateParams
- ✅ Ordering dropdown synchronizes with URL and API
- ✅ URL persistence for all filter states
- ✅ Reset button clears all filters

### FASE-LEADS-FILTROS-02: End-to-End Query Connection (Complete)
- ✅ Frontend: URL params → React Query queryKey → API call
- ✅ Input debounce 300ms → URL update (with immediate local feedback)
- ✅ All filters (q, estado, entidadeId, contactoId, hasOdoo) in queryKey
- ✅ Backend: GET /api/crm/leads implements filtering (titulo/descricao/marca search)
- ✅ Backend: ORDER BY with orderBy/orderDir support
- ✅ Query re-executes on any param change → data updates

### FASE-LEADS-FILTROS-03: In-Memory Filtering & Sorting (Complete)
- ✅ Frontend in-memory filtering on allLeads (q, estado, entidadeId, contactoId, hasOdoo)
- ✅ Frontend in-memory sorting (createdAt, titulo, valorPrevisto with asc/desc)
- ✅ Redundant security layer with backend filtering
- ✅ Dynamic result count and differentiated messaging
- ✅ Table renders sortedLeads with all filters/sorting applied

### RBAC Refactoring (In Progress)
- ✅ **ENTIDADES-RBAC-STEP1**: Centralized `buildEntidadeAccessWhere` helper + `ListEntidadesParams` object
- ✅ **CONTACTOS-RBAC-STEP1**: Applied same pattern - `buildContactoAccessWhere` helper + `ListContactosParams` object
- Updated 3 calls in routes.ts to use new params object format
- 📋 TODO: Apply same pattern to Visitas, Tarefas in next sprints

## System Architecture

### Frontend Architecture
A mobile-first React 18 application using TypeScript, Wouter for routing, and Vite. It leverages Shadcn/ui (New York style) with Radix UI and Tailwind CSS, adhering to Material Design principles. State management is handled by TanStack React Query, and form validation by React Hook Form with Zod. UI patterns emphasize card-based layouts, search-first interfaces, and Floating Action Buttons (FABs). It supports adaptive layouts for various user roles and dynamically applies company-specific themes.

### Backend Architecture
An Express.js application in TypeScript, utilizing session-based authentication via Replit Auth (OpenID Connect) and Passport.js, with sessions stored in PostgreSQL. It provides RESTful APIs for authentication, universal entities, contacts, visits (including file uploads and audio transcription), tasks, and analytics. Multer handles file uploads. A robust RBAC system differentiates Admin (full data access) and Agent (owner/assigned data access) roles, enforcing ownership checks.

### Database Architecture
PostgreSQL with Drizzle ORM ensures type-safe schema management. Key entities include Users, a universal `Entidades` system, Contactos, Visitas (with media, audio, AI summaries, geolocation, and brands), Tarefas, Lembretes, Marcas, and Sessions. Relationships are managed through foreign keys. The `empresas` table includes `theme` for customization, `mostrarGPS` for GPS visibility, and `openai_api_key` for company-specific OpenAI API keys (never exposed to frontend). `entidade_tipos` allows for flexible, company-configurable entity categorization. `visitasContactos` handles many-to-many relationships between visits and contacts.

### System Design Choices
-   **Multi-tenant Architecture**: Supports multiple companies with complete data isolation.
-   **Role-Based Access Control (RBAC)**: Granular access control for Admin and Agent roles.
-   **Dynamic Theming**: Configurable themes per company.
-   **AI-powered Features**: Audio transcription, visit summaries, and executive PDF summaries.
-   **Universal Entidades System**: Flexible business entity types, configurable per company.
-   **Offline Capabilities**: Data caching with IndexedDB and automatic synchronization.
-   **Geolocation Integration**: Automatic GPS capture for visits and proximity suggestions.
-   **Calendar Integration**: Generates RFC 5545 compliant `.ics` files.
-   **PDF Export**: Backend-generated reports with photos, AI summaries, and smart pagination.
-   **Advanced Analytics**: RBAC-aware dashboard with KPIs and visualizations, including AI insights.
-   **Configurable Entity Types**: Company-specific entity type management with color coding and filtering.
-   **Multi-Contact Support for Visits**: Allows associating multiple contacts per visit, with a company-level toggle for single vs. multi-contact mode.
-   **Company-level AI Configuration**: Supports global OpenAI API key usage or "Bring Your Own Key" (BYOK) mode for advanced companies, with secure storage of API keys.

## External Dependencies

-   **Neon Database**: Serverless PostgreSQL hosting.
-   **OpenAI API**: For Whisper (audio transcription) and GPT-4o-mini (visit summaries, email generation, executive PDF summaries).
-   **Replit Authentication**: OAuth/OIDC provider for user authentication.
-   **Multer**: For handling file uploads.
-   **Radix UI**: UI primitives.
-   **Lucide React**: Iconography.
-   **date-fns**: For date manipulation.
-   **chartjs-node-canvas**: For server-side chart rendering in PDF exports.
-   **DOMPurify**: For XSS prevention in rich text content.
### FASE-LEADS-FILTROS-04: Navigation Path Preservation (Complete)
- ✅ **updateParams**: Now extracts and preserves currentPath (/admin/leads)
- ✅ **resetFilters**: Clears only query string, keeps current path
- ✅ URL now correctly shows /admin/leads?filters instead of /?filters
- ✅ URL persistence works (bookmarks, sharing, reload)
- ✅ Browser history navigation works correctly
