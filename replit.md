# Commercial Visits Management PWA

## Overview
This Progressive Web Application (PWA) streamlines commercial visit management for field sales professionals. It tracks entities, contacts, and visits, offering AI-powered summaries, audio transcription, automated notifications, geolocation, calendar integration, PDF export, and analytics. The application aims to enhance data quality and provide actionable insights for sales teams. It is a full-stack TypeScript solution with a React frontend, Express backend, and PostgreSQL with Drizzle ORM, built with a mobile-first, multi-tenant architecture and robust security, including user data isolation and Role-Based Access Control (RBAC).

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
A mobile-first React 18 application using TypeScript, Wouter for routing, and Vite. It utilizes Shadcn/ui (New York style) with Radix UI and Tailwind CSS, adhering to Material Design principles. State management is handled by TanStack React Query and React Hook Form with Zod for validation. UI patterns emphasize card-based layouts, search-first interfaces, and Floating Action Buttons (FABs). It features adaptive layouts based on user roles (mobile-first for agents with bottom nav, desktop sidebar for admins, and mobile drawer for admins on small screens). Company-specific themes are supported and applied dynamically.

### Backend Architecture
An Express.js application in TypeScript, employing session-based authentication with Replit Auth (OpenID Connect) and Passport.js, storing sessions in PostgreSQL. It provides RESTful APIs for authentication, universal entities, contacts, visits (including file uploads and audio transcription), tasks, and analytics. Multer handles file uploads. A robust RBAC system differentiates Admin (all data access) and Agent (owner/assigned data access) roles, enforcing ownership checks across all data operations.

### Database Architecture
PostgreSQL with Drizzle ORM ensures type-safe schema management. Key entities include Users, a universal Entidades system (e.g., Gabinete, Cliente, Distribuidor), Contactos, Visitas (with media, audio, AI summaries, geolocation, and brands), Tarefas (rich text), Lembretes, Marcas (product brands), and Sessions. Relationships are managed via foreign keys. The `visitasMarcas` junction table manages many-to-many relationships. A `visitasAudio` table stores audio clips for visits. The `empresas` table includes `theme` for customization and `mostrarGPS` for GPS visibility control. The `visitaAnteriorId` field in the `visitas` table tracks visit relationships for historical context.

### System Design Choices

-   **Multi-tenant Architecture**: Supports multiple companies with complete data isolation.
-   **Role-Based Access Control (RBAC)**: Differentiates Admin and Agent roles with granular access control.
-   **Dynamic Theming**: Companies can select a theme (`light-business`, `dark-pro`).
-   **Audio Transcription**: AI-powered audio transcription for visit notes.
-   **Universal Entidades System**: Flexible system supporting various business entity types.
-   **Rich Text Task Descriptions**: Utilizes TipTap editor with XSS prevention.
-   **Offline Capabilities**: Comprehensive support with IndexedDB for data caching and automatic synchronization.
-   **Geolocation Integration**: Automatic GPS capture for visits.
-   **Calendar Integration**: Generates RFC 5545 compliant `.ics` files.
-   **PDF Export**: Backend-generated PDF reports with photos, AI summaries, and smart pagination.
-   **Advanced Analytics**: RBAC-aware dashboard with KPIs and visualizations.
-   **Universal Contact Recognition Module**: Supports contact import via QR code, vCard, and AI-powered business card scanning.
-   **Google Custom Search Enrichment Module**: Uses Google Custom Search and GPT-4o-mini for company data enrichment.
-   **Intelligent Reminder System**: Proactive engine for visit follow-ups, overdue tasks, and AI-suggested reminders.
-   **PRO Exports Module**: Advanced PDF generation with analytics, charts, and professional executive summaries via OpenAI GPT-4o-mini.
-   **Advanced Filtering**: Comprehensive filtering capabilities for visits and tasks.
-   **Visit Relationship Tracking**: System for creating related visits from scheduled appointments, with complete history tracking.
-   **Full CRUD Operations**: Complete Edit and Delete UI for all entities with role-based access control.
-   **Responsive Admin Layout**: Desktop sidebar adapts to a mobile drawer for optimal UX.
-   **AI-to-Task Conversion**: Direct conversion of AI-suggested tasks to real system tasks with one click, including pre-filled forms and linking to the originating visit.
-   **Real-time Alerts & Badges**: Visual notifications for pending/overdue tasks and today's visits across all navigation surfaces.
-   **Unified Visit Status Management**: Consolidated "Atualizar Estado" dialog with 3 distinct action paths (follow-up, mark done only, cancel appointment) for scheduled visits, with overdue status detection.
-   **Persistent AI Suggestions**: Links created tasks/visits from AI suggestions, maintaining state after page reloads.
-   **Admin Settings Center**: Organized 6-tab settings page with company configuration, logo upload, and UI settings JSON for future extensibility (FASE 22).
-   **Logo Upload**: Direct upload of company logo with preview, type validation (PNG/JPG/SVG/WebP), and automatic database persistence.

## Recent Features (FASE 20-23)

### FASE 20: Unified Visit Status Management
- Consolidated modal dialog for appointment status changes with 3 visual action paths (follow-up, mark done, cancel)
- "Overdue appointment" badge for dates in the past
- 4 distinct card states: Scheduled, Realized, Cancelled, Follow-up created

### FASE 21: Persistent AI Suggestions  
- AI suggestion cards now persistently link to created tasks/visits via `tarefaId`/`visitaId` stored in JSON
- State preserved across page reloads (not just local memory)
- Frontend renders "Ver Tarefa"/"Ver Agendamento" instead of "Criar..." when linked

### FASE 22: Admin Settings Center + Logo Upload
- 6-tab settings page: Geral, Visitas & Tarefas, IA & Transcrição, Localização & Privacidade, Alertas & UX, Integrações
- Logo upload endpoint with file validation and automatic URL persistence
- JSON-based `uiSettings` field for future configuration extensibility
- Placeholder integrations (Outlook, Planner) ready for future OAuth setup

### FASE 23: IA Insights Dashboard with RBAC + Feature Toggle
- **Dashboard Insights Card**: AI-powered analysis on dashboard (agent personal, admin team-wide)
- **RBAC Differentiation**: Storage layer filters data by userId (agent) vs empresaId (admin)
- **Scope-aware Prompts**: OpenAI prompt adapts language (personal vs team context)
- **Feature Toggle**: `uiSettings.enableIA` flag controls dashboard insights activation
- **Settings UI**: Toggle in Admin Settings (IA & Áudio tab) to enable/disable insights
- **No API Calls When Disabled**: Backend returns message without calling OpenAI when flag is false
- **Metrics Collection**: Aggregates visits, tasks, top clients, brands over 30-day period
- **Visual Design**: Amber-themed card with Lightbulb icon, positioned above PDF export
- **Components**: New `DashboardInsightsCard.tsx`, integrated in Dashboard.tsx and AdminDashboard.tsx

## External Dependencies

-   **Neon Database**: Serverless PostgreSQL hosting.
-   **OpenAI API**: Used for Whisper (audio transcription), GPT-4o-mini (visit summaries, email generation, executive PDF summaries).
-   **Replit Authentication**: OAuth/OIDC provider for user authentication.
-   **Multer**: Handles file uploads.
-   **Radix UI**: UI primitives.
-   **Lucide React**: Iconography.
-   **date-fns**: Date manipulation and timezone-aware comparisons.
-   **chartjs-node-canvas**: Server-side chart rendering for PDF exports.
-   **DOMPurify**: XSS prevention for rich text.