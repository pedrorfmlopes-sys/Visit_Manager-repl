# Commercial Visits Management PWA

## Overview
This Progressive Web Application (PWA) streamlines commercial visit management for field sales professionals. It tracks entities, contacts, and visits, offering features like audio transcription, AI-powered summaries, automated email notifications, geolocation, calendar integration, PDF export, and analytics. The application aims to enhance sales team efficiency, data quality, and provide actionable insights. It is a full-stack TypeScript solution with a React frontend, Express backend, and PostgreSQL with Drizzle ORM, built with a mobile-first approach and robust security including user data isolation and Role-Based Access Control (RBAC). The project supports multi-tenant architecture to ensure company isolation.

## User Preferences
Preferred communication style: Simple, everyday language.

## Project Status

### FASE Completion
- FASE 1: Multi-empresa architecture (completed)
- FASE 2: 24 API endpoints with empresaId filtering (completed)
- FASE 3: Backoffice Admin API - 9 endpoints for empresa, utilizadores, marcas (completed)

### FASE 4 Implementation
Frontend backoffice with 3 admin pages (AdminEmpresa, AdminUsers, AdminMarcas). Protected routes with AdminRoute wrapper. Admin links in BottomNav visible only to admins. Auth system enhanced to return empresa data including mostrarMarcasEmVisitas flag.

### FASE 5 Implementation (Marcas em Visitas + Logo da Empresa)
**Backend:**
- Created `visitasMarcas` junction table (visitaId, marcaId, empresaId) for many-to-many relationship
- Updated `getVisita()` storage to fetch related marcas with `with: { marcas: { with: { marca: true } } }`
- Added `addMarcasToVisita(visitaId, marcasIds[], empresaId)` storage function
- Modified POST/PATCH `/api/visitas` to accept `marcasIds` array and manage relationships
- Migration: `npm run db:push` created `visitas_marcas` table successfully

**Frontend:**
- VisitaForm: Added condicional "Marcas Faladas" field (shows only if `empresa.mostrarMarcasEmVisitas === true`)
  - Fetches marcas via `GET /api/marcas?onlyAtivas=true`
  - Multi-select with Badge UI (tap to select/deselect)
  - Sends `marcasIds` array to backend
- VisitaDetail: Shows marcas section with Badge display (reads from `visita.marcas` relationship)
- App.tsx: Added company logo display in sticky header (if `empresa.logoUrl` exists)
  - Logo fails gracefully if URL is invalid

**Database:** Table `visitas_marcas` created with PKs: (visitaId, marcaId, empresaId)

### FASE 6 Implementation (Áudio em Visitas com Transcrição por IA)
**Database:**
- Created `visitasAudio` table: id (PK), visitaId (FK), empresaId (FK), fileUrl, transcricao (optional), createdAt
- Enforces multi-tenant isolation: empresaId always validated

**Backend Storage Functions:**
- `addAudioToVisita(visitaId, fileUrl, empresaId)` - Add audio clip
- `getVisitasAudio(visitaId, empresaId)` - List all audio clips for visit (ordered by newest first)
- `deleteVisitasAudio(audioId, empresaId)` - Delete audio clip (with empresaId validation)
- `updateVisitasAudioTranscription(audioId, transcricao)` - Update transcription text

**Backend Endpoints:**
- POST `/api/visitas/:id/audio` - Upload audio file (multipart, uses Multer)
- GET `/api/visitas/:id/audio` - List audio clips for visit
- DELETE `/api/visitas/:id/audio/:audioId` - Delete specific audio clip
- POST `/api/visitas/:id/audio/:audioId/transcrever` - Transcribe audio via OpenAI Whisper (PT language)

**Frontend:**
- VisitaForm: Existing "Áudio da Visita" file input (uploads during visit creation via POST /api/visitas)
- VisitaDetail: Added "Áudio da Visita" section (FASE 6) showing:
  - List of audio clips with dates
  - "Ouvir" link to download/play audio
  - "Transcrever" button (AI-powered, only if not yet transcribed)
  - "Transcrito" badge (shows when transcription done)
  - Delete button with confirmation
  - Transcription text display (if available)
  - All mutations with loading states and success/error toasts

**Architecture:**
- Audio clips stored separately from visita (1-to-many relationship via visitasAudio table)
- Multi-visit support: Can add/manage multiple audio clips per visit after creation
- Transcription is async via OpenAI Whisper API (requires OPENAI_API_KEY)
- User must have access to visita to manage its audio (empresaId + role validation)

### FASE 9 Implementation (Tema por Empresa)

**FASE 9.1 Implementada (23/11/2025):**
- Adicionado campo `theme` à tabela `empresas`: varchar(50), default "light-business", NOT NULL
- Schema: tema com enum ["light-business", "dark-pro"]
- API `PATCH /api/admin/empresa`: Aceita e valida campo `theme`
- Frontend: AdminEmpresa.tsx com Select de tema (2 opções)
- Migração DB: Campo criado com default "light-business"
- Funcionalidade: Temas guardados e recuperados corretamente

**FASE 9.2 Implementada (23/11/2025):**
- Backend: `/api/auth/user` agora retorna `empresa.theme` junto com dados da empresa
- Frontend: `useAuth()` hook atualizado para incluir `theme` na interface `AuthUser`
- App.tsx: UseEffect que aplica tema baseado em `empresa.theme`
  - Se theme === "dark-pro": Adiciona classe "dark" a document.documentElement + data-theme="dark-pro"
  - Se theme === "light-business": Remove classe "dark" + data-theme="light-business"
- CSS global (index.css): Seletores `:root[data-theme="light-business"]` e `:root[data-theme="dark-pro"]` ligadas aos estilos Tailwind
- Tailwind config: `darkMode: ["class"]` já configurado - CSS dark-mode aproveita automaticamente
- Resultado: Mudança visual imediata (cores, backgrounds, texto) ao alternar entre temas
- Temas persistem na BD e aplicam automaticamente ao recarregar a app

## System Architecture

### Frontend Architecture
A mobile-first React 18 application using TypeScript, Wouter for routing, and Vite for bundling. It leverages Shadcn/ui (New York style) with Radix UI and Tailwind CSS, adhering to Material Design principles. State management is handled by TanStack React Query and React Hook Form with Zod for validation. UI patterns emphasize card-based layouts, search-first interfaces, and Floating Action Buttons (FABs).

### Backend Architecture
An Express.js application in TypeScript, employing session-based authentication with Replit Auth (OpenID Connect) and Passport.js, storing sessions in PostgreSQL. It provides RESTful APIs for authentication, universal entities, contacts, visits (including file uploads), tasks, and analytics. Multer handles file uploads. A robust RBAC system differentiates Admin (all data access) and Agent (owner/assigned data access) roles, enforcing ownership checks across all data operations.

### Database Architecture
PostgreSQL with Drizzle ORM ensures type-safe schema management. Key entities include Users, a universal Entidades system (replacing "Gabinetes" with types like Gabinete, Cliente, Distribuidor, Obra, Parceiro, Outro), Contactos, Visitas (with media, audio, AI summaries, geolocation), Tarefas (rich text, HTML support, XSS prevention), Lembretes (intelligent reminders for follow-ups, overdue tasks, AI suggestions), Marcas (product brands), and Sessions. Relationships are managed via foreign keys, and data integrity is maintained with timestamp tracking.

### System Design Choices

-   **Multi-tenant Architecture**: Supports multiple companies with complete data isolation for entities, contacts, visits, tasks, reminders, and brands.
-   **Rich Text Task Descriptions**: Utilizes TipTap editor for comprehensive formatting, stored as sanitized HTML in the database (DOMPurify for XSS prevention).
-   **Offline Capabilities**: Comprehensive support with IndexedDB for data caching and automatic synchronization for created entities, contacts, and tasks.
-   **Geolocation Integration**: Automatic GPS capture for visits with map links.
-   **Calendar Integration**: Generates RFC 5545 compliant `.ics` files for visits and tasks.
-   **PDF Export**: Backend-generated PDF reports for visits and entities, including photos, AI summaries, tasks, and smart pagination.
-   **Advanced Analytics**: RBAC-aware dashboard with KPIs and visualizations for visits, tasks, entities, and brands.
-   **Universal Entidades System**: Flexible system supporting various business entity types.
-   **Universal Contact Recognition Module**: Supports contact import via QR code scanning, vCard parsing, and AI-powered business card vision scanning (OpenAI gpt-4o vision API). Includes universal auto-creation logic and offline queue support.
-   **Google Custom Search Enrichment Module**: Uses Google Custom Search and GPT-4o-mini for company data enrichment, with fuzzy matching against local data, caching, and rate limiting. Includes robust `tipoEntidade` validation to prevent searching for personal contacts.
-   **Intelligent Reminder System**: Proactive engine generating reminders for visit follow-ups, overdue tasks, and future AI-suggested reminders, all RBAC-aware.
-   **PRO Exports Module**: Advanced PDF generation with analytics, charts, and AI-powered summaries for visits, entities, and periodic reports (monthly/weekly). Features server-side chart rendering (chartjs-node-canvas) and professional PT-PT executive summaries via OpenAI GPT-4o-mini.

## External Dependencies

-   **Neon Database**: Serverless PostgreSQL hosting.
-   **OpenAI API**: Used for Whisper (audio transcription), GPT-4o-mini (visit summaries, email generation, executive PDF summaries).
-   **Replit Authentication**: OAuth/OIDC provider for user authentication.
-   **Email Integration**: Planned for services like Resend or SendGrid for automated notifications.
-   **UI Component Dependencies**: Radix UI, Lucide React (iconography), date-fns (date manipulation).