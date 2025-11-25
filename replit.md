# Commercial Visits Management PWA

## Overview
This Progressive Web Application (PWA) streamlines commercial visit management for field sales professionals. It tracks entities, contacts, and visits, offering AI-powered summaries, audio transcription, automated notifications, geolocation, calendar integration, PDF export, and analytics. The application aims to enhance data quality and provide actionable insights to sales teams. It's a full-stack TypeScript solution with a React frontend, Express backend, and PostgreSQL with Drizzle ORM, featuring a mobile-first, multi-tenant architecture with user data isolation and Role-Based Access Control (RBAC).

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
A mobile-first React 18 application built with TypeScript, Wouter for routing, and Vite. It utilizes Shadcn/ui (New York style) with Radix UI and Tailwind CSS, adhering to Material Design principles. State management is handled by TanStack React Query, and form validation by React Hook Form with Zod. UI patterns emphasize card-based layouts, search-first interfaces, and Floating Action Buttons (FABs). It supports adaptive layouts for different user roles (mobile-first for agents, desktop sidebar for admins, mobile drawer for admins on small screens). Company-specific themes are dynamically applied.

### Backend Architecture
An Express.js application in TypeScript, using session-based authentication via Replit Auth (OpenID Connect) and Passport.js, with sessions stored in PostgreSQL. It provides RESTful APIs for authentication, universal entities, contacts, visits (including file uploads and audio transcription), tasks, and analytics. Multer handles file uploads. A robust RBAC system differentiates Admin (full data access) and Agent (owner/assigned data access) roles, enforcing ownership checks.

### Database Architecture
PostgreSQL with Drizzle ORM provides type-safe schema management. Core entities include Users, a universal `Entidades` system, Contactos, Visitas (with media, audio, AI summaries, geolocation, and brands), Tarefas, Lembretes, Marcas, and Sessions. Relationships are managed through foreign keys. `visitasMarcas` handles many-to-many relationships, `visitasAudio` stores audio clips. The `empresas` table includes `theme` for customization and `mostrarGPS` for GPS visibility. `visitaAnteriorId` tracks historical visit relationships. `entidade_tipos` allows company-configurable entity types for flexible categorization.

### System Design Choices
-   **Multi-tenant Architecture**: Supports multiple companies with complete data isolation.
-   **Role-Based Access Control (RBAC)**: Granular access control for Admin and Agent roles.
-   **Dynamic Theming**: Configurable themes per company.
-   **AI-powered Features**: Audio transcription, visit summaries, and executive PDF summaries.
-   **Universal Entidades System**: Flexible business entity types, configurable per company.
-   **Rich Text Editor**: TipTap editor for tasks with XSS prevention.
-   **Offline Capabilities**: Data caching with IndexedDB and automatic synchronization.
-   **Geolocation Integration**: Automatic GPS capture for visits and proximity suggestions.
-   **Calendar Integration**: Generates RFC 5545 compliant `.ics` files.
-   **PDF Export**: Backend-generated reports with photos, AI summaries, and smart pagination.
-   **Advanced Analytics**: RBAC-aware dashboard with KPIs and visualizations, including AI insights.
-   **Universal Contact Recognition**: Supports QR code, vCard, and AI business card scanning for contact import.
-   **Intelligent Reminder System**: Proactive engine for follow-ups, overdue tasks, and AI-suggested reminders.
-   **PRO Exports Module**: Advanced PDF generation with analytics, charts, and AI-powered executive summaries.
-   **Advanced Filtering**: Comprehensive filtering for visits and tasks.
-   **Visit Relationship Tracking**: Tracks related visits and appointment history.
-   **Full CRUD Operations**: Complete Edit and Delete UI for all entities with role-based access.
-   **Responsive Admin Layout**: Desktop sidebar adapts to a mobile drawer.
-   **AI-to-Task Conversion**: One-click conversion of AI suggestions to system tasks.
-   **Real-time Alerts & Badges**: Visual notifications for pending/overdue tasks and today's visits.
-   **Unified Visit Status Management**: Consolidated dialog for managing scheduled visit statuses.
-   **Persistent AI Suggestions**: Maintains state of linked tasks/visits from AI suggestions across reloads.
-   **Admin Settings Center**: Organized settings with company configuration, logo upload, and UI settings.
-   **Configurable Entity Types**: Company-specific entity type management with color coding and filtering, including configurable icons.
-   **Multi-Contact Support for Visits**: Allows associating multiple contacts per visit with dedicated UI for selection, display, and editing.
-   **Contact History Tracking**: Displays a contact's visit history with dynamic date range filtering.

## External Dependencies

-   **Neon Database**: Serverless PostgreSQL hosting.
-   **OpenAI API**: For Whisper (audio transcription) and GPT-4o-mini (visit summaries, email generation, executive PDF summaries).
-   **Replit Authentication**: OAuth/OIDC provider for user authentication.
-   **Multer**: For handling file uploads.
-   **Radix UI**: UI primitives.
-   **Lucide React**: Iconography.
-   **date-fns**: For date manipulation and timezone-aware comparisons.
-   **chartjs-node-canvas**: For server-side chart rendering in PDF exports.
-   **DOMPurify**: For XSS prevention in rich text content.
## Última Actualização - FASES 1-5 (25 Novembro 2025)

### Implementação: Sistema N:N para Múltiplos Contactos por Visita

**Ficheiro de Relatório Completo**: `RELATORIO_FASES_1_5.md`

**Fase 1-3: Backend + Junction Table**
- ✅ Tabela `visitasContactos` criada
- ✅ Storage methods: `addContactosToVisita()`, `getContactosFromVisita()`
- ✅ API GET /visitas com filtro `contactoId`
- ✅ API PATCH /visitas com `contactosIds[]`
- ✅ 13 visitas migradas
- ✅ Backward compatible

**Fase 4: Detalhe Visita - Editar Contactos**
- ✅ Secção "Contactos Presentes" com lista
- ✅ Dialog "Editar Contactos" com multi-select + search
- ✅ Admin-only controls
- ✅ Pre-fill com contactos actuais
- ✅ Mutation + cache invalidation

**Fase 5: Detalhe Contacto - Histórico Visitas**
- ✅ Secção "Visitas em que participou"
- ✅ Filtro por período (30/90/180/365/all dias)
- ✅ Query dinâmica com date range
- ✅ Lista clickable com navegação
- ✅ Empty state message
- ✅ Backend eager-loading `.contactos`

**Bugs Corrigidos**
- ✅ getVisitas() agora carrega junction table
- ✅ PATCH aceita contactosIds como único campo

**Build Status**: ✅ Passing
**Performance**: ~200-250ms queries
**Test**: Funcional end-to-end
