# Commercial Visits Management PWA

## Overview
This Progressive Web Application (PWA) is designed to enhance the efficiency of field sales professionals by streamlining commercial visit management. It provides a comprehensive solution for tracking entities, contacts, and visits, featuring AI-powered summaries, audio transcription, automated notifications, geolocation, calendar integration, PDF export, and analytics. The application aims to improve data quality and provide actionable insights for sales teams. It is a full-stack TypeScript solution with a React frontend, Express backend, and PostgreSQL with Drizzle ORM, built with a mobile-first approach, multi-tenant architecture, and robust security including user data isolation and Role-Based Access Control (RBAC).

## User Preferences
Preferred communication style: Simple, everyday language.

## Project Status - FASE 19 IMPLEMENTED

### FASE 19: Alerts & Badges (Real-time Task/Visit Notifications) - COMPLETED 24/11/2025

**Objetivo:** Notificações visuais em tempo real com badges para tarefas/visitas pendentes sem abrir páginas.

**Implementação:**

1. **Hook `useTodaySummary()` (Reutilizável):**
   - Novo ficheiro: `client/src/hooks/use-today-summary.ts`
   - Calcula automaticamente:
     - `tarefasPendentes`: Total de tarefas com status="pending"
     - `tarefasAtrasadas`: Tarefas pendentes com dueDate < hoje
     - `tarefasHoje`: Tarefas pendentes com dueDate = hoje
     - `visitasHoje`: Visitas com dataVisita = hoje
   - Queries leves com refetch a 2 minutos (120s)
   - Reutiliza endpoints existentes: `GET /api/tarefas` + `GET /api/visitas`
   - Sem novos endpoints backend

2. **BottomNav Badges (Agent Layout):**
   - Modificado: `client/src/components/BottomNav.tsx`
   - Tab **Visitas**: Badge com contador de visitas hoje
   - Tab **Tarefas**: 
     - Se houver atrasadas → Badge **vermelho** (destructive)
     - Se apenas hoje → Badge **azul** (default)
     - Prioridade: Atrasadas > Hoje
   - Tab **Lembretes**: Mantém badge (já existia)
   - Badges ocultam se contador = 0
   - Mostra "9+" se contador > 9
   - Data-testids para QA: `badge-tasks-overdue`, `badge-tasks-today`, `badge-visits-today`

3. **AdminSidebar Badges (Desktop Admin):**
   - Modificado: `client/src/components/AdminSidebar.tsx`
   - Item **Tarefas**: Badge similar ao BottomNav (vermelho/azul)
   - Item **Visitas**: Badge com contador visitas hoje
   - Posicionado à direita do texto (ml-auto)
   - Integra useTodaySummary() hook

4. **AdminDrawer Badges (Mobile Admin):**
   - Modificado: `client/src/components/AdminDrawer.tsx`
   - Mesma lógica que Sidebar
   - Badges aparecem em ambientes mobile e desktop
   - Comportamento idêntico

5. **AlertRibbon Component (Alert Sticky):**
   - Novo ficheiro: `client/src/components/AlertRibbon.tsx`
   - Barra sticky no topo (z-30, abaixo do header)
   - **Lógica de prioridade:**
     1. Se `tarefasAtrasadas > 0` → Mostra aviso **vermelho**: "Tens X tarefa(s) em atraso"
     2. Else se `tarefasHoje > 0` → Mostra aviso **azul**: "Tens X tarefa(s) para hoje"
     3. Else se `visitasHoje > 0` → Mostra aviso **azul**: "Tens X visita(s) marcada(s) para hoje"
     4. Else → Sem aviso (return null)
   - Botão "Ver" que navega para `/tarefas`
   - Desaparece automaticamente se não houver alertas
   - Icons: AlertCircle (vermelho) ou Calendar (azul)

6. **Integration with MainLayout:**
   - Modificado: `client/src/layouts/MainLayout.tsx`
   - AlertRibbon renderizado **abaixo do header** para ambos Admin e Agent
   - Admin: Abaixo do logo (desktop) ou TopBar (mobile)
   - Agent: Abaixo do logo
   - Posicionado acima do content principal
   - Z-index garantido para visibilidade

**UX Features:**

| Item | Admin Desktop | Admin Mobile | Agent |
|------|---------------|--------------|-------|
| Sidebar Badges | ✅ Tarefas + Visitas | ✅ Drawer | ✅ BottomNav |
| Alert Ribbon | ✅ Sticky | ✅ Sticky | ✅ Sticky |
| Prioridade | Atrasadas > Hoje | Atrasadas > Hoje | Atrasadas > Hoje |
| Refetch | 2 minutos | 2 minutos | 2 minutos |
| RBAC Filtering | ✅ Via API | ✅ Via API | ✅ Via API |

**Data Accuracy:**

- Filtros aplicados pelo backend (`GET /api/tarefas`, `GET /api/visitas`)
- Contadores computados no frontend com `date-fns`
- Comparação de datas: `isBefore()`, `isToday()` de date-fns
- Timezone: Usa `new Date()` do cliente
- Multi-empresa: Automático (backend já filtra por empresaId)

**Performance:**

- Queries tipadas com TanStack Query
- TTL de 2 minutos para evitar sobrecarregar backend
- Sem polling constante (apenas refetch em background)
- Reutiliza queries existentes (cache compartilhado)
- Badge rendering otimizado (apenas calcula se dados mudarem)

**Data-Testids (QA):**

- `badge-tasks-overdue` - Badge tarefas atrasadas
- `badge-tasks-today` - Badge tarefas para hoje
- `badge-visits-today` - Badge visitas para hoje
- `badge-sidebar-tarefas` - Sidebar badge (admin)
- `badge-sidebar-visitas` - Sidebar badge (admin)
- `badge-drawer-tarefas` - Drawer badge (mobile admin)
- `badge-drawer-visitas` - Drawer badge (mobile admin)
- `button-alert-ribbon-action` - Botão "Ver" no AlertRibbon

**Result:**

- ✅ Badges em tempo real (atualizam a cada 2 minutos)
- ✅ BottomNav + Sidebar + Drawer integrados
- ✅ AlertRibbon sticky no topo com prioridade
- ✅ RBAC respeitado (backend filtra por empresaId)
- ✅ Sem novos endpoints backend
- ✅ Reusa `useTodaySummary()` em múltiplos componentes
- ✅ Desempenho otimizado (queries leves, refetch moderado)
- ✅ Design respeitado (tema light-business/dark-pro adaptado)

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
-   **Audio Transcription**: AI-powered audio transcription for visit notes using OpenAI Whisper.
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
