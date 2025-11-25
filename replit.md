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
PostgreSQL with Drizzle ORM provides type-safe schema management. Core entities include Users, a universal `Entidades` system, Contactos, Visitas (with media, audio, AI summaries, geolocation, and brands), Tarefas, Lembretes, Marcas, and Sessions. Relationships are managed through foreign keys. `visitasMarcas` handles many-to-many relationships, `visitasAudio` stores audio clips. The `empresas` table includes `theme` for customization and `mostrarGPS` for GPS visibility. `visitaAnteriorId` tracks historical visit relationships. `entidade_tipos` allows company-configurable entity types for flexible categorization. `visitasContactos` handles many-to-many relationship between visits and contacts.

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
-   **Configurable Single vs Multi-Contact Mode**: Company-level toggle to switch between single and multiple contact selection per visit.

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

## Relatório de Implementação - FASES 0 a 1

### Actualização: 25 Novembro 2025, 16h10

**Status Geral**: ✅ Fase 1 Completa e Funcional

#### FASE 0: Flag de Configuração (Completada 25 Nov, ~15h45)
- ✅ Backend: Adicionada flag `uiSettings.visitas.multiContactosEnabled` (default: false)
- ✅ Frontend: Toggle adicionado em `/admin/empresa` → "Visitas & Tarefas" → "Comportamento"
- ✅ API: GET/PATCH já suportam `uiSettings` (sem alterações necessárias)
- ✅ Build: Passing
- ✅ Storage layer: Atualizado para persister a flag

#### FASE 1: Frontend VisitaForm - Respeitar Flag (Completada 25 Nov, ~16h10)
**Arquivo Modificado**: `client/src/pages/VisitaForm.tsx`

**Objetivo Alcançado**: 
O formulário de criação/edição de visitas agora adapta o comportamento de selecção de contactos com base na flag `multiContactosEnabled`:

**Implementação**:

1. **Leitura da Flag**:
   - `const multiContactosEnabled = empresa?.uiSettings?.visitas?.multiContactosEnabled ?? false;`
   - Flag é acedida através do contexto `useAuth()` (gancho que carrega `empresa`)

2. **Lógica de Selecção de Contactos** (linhas 710-726):
   - **Modo Single (flag = false)**:
     - Se contacto já está seleccionado → desselecciona (fica vazio)
     - Se contacto não está seleccionado → substitui o array inteiro por `[id]`
     - Permite sempre apenas 1 contacto no máximo
   
   - **Modo Multi (flag = true)**:
     - Comportamento original mantido
     - Add/remove normal (toggle de IDs no array)
     - Permite vários contactos

3. **Adaptação Visual**:
   - **Label dinâmico** (linha 662):
     - Single: "Contacto da visita"
     - Multi: "Contactos presentes na visita"
   
   - **Texto do botão** (linhas 673-679):
     - Single: Mostra nome do contacto seleccionado (e.g., "João Silva")
     - Multi: Mostra contagem (e.g., "2 contactos selecionados")
   
   - **Descrição dinâmica** (linhas 766-772):
     - Single: "Seleciona um contacto que esteve presente nesta visita. Clica noutro para substituir."
     - Multi: "Escolhe um ou mais contactos que estiveram presentes nesta visita"

4. **Payload Preservado**:
   - Em ambos os modos, o payload é enviado como `contactosIds[]`
   - Single mode: `[]` ou `[unicoId]`
   - Multi mode: `[]`, `[id1]`, `[id1, id2, ...]`

**Critérios de Aceitação - Validados ✅**:

| Cenário | Com Flag = false | Com Flag = true |
|---------|------------------|-----------------|
| Label do campo | "Contacto da visita" | "Contactos presentes na visita" |
| Seleccionar 1º contacto | ✅ Selecciona | ✅ Selecciona |
| Seleccionar 2º contacto | ✅ Substitui 1º | ✅ Adiciona (multi) |
| Máximo de contactos | 1 | Ilimitado |
| Badge display | 1 badge | N badges |
| Descrição helper text | "Clica noutro para substituir" | "Escolhe um ou mais" |
| Payload enviado | `[id]` ou `[]` | `[id1, id2, ...]` ou `[]` |

**Build Status**: ✅ Passing (287.2kb bundle)

**Testes Realizados**:
- ✅ Frontend carrega correctamente com empresa data
- ✅ Toggle do flag em AdminEmpresa funciona
- ✅ VisitaForm adapta UI com base na flag
- ✅ Single-select mode respeita 1 contacto máximo
- ✅ Multi-select mode mantém comportamento original
- ✅ Hot reload funciona (Vite)
- ✅ Logs confirmam flag é correctamente lida

**Próximas Fases Potenciais**:
- Fase 2: Validação backend se max contactos = 1 quando flag = false
- Fase 3: Testes E2E para ambos os modos
- Fase 4: Migração de contactos antigos para novo sistema
- Fase 5: Analytics e monitoring

**Ficheiros Actualizados**:
- `replit.md` (este)
- `client/src/pages/VisitaForm.tsx` (linhas 652-777)

**Notas Técnicas**:
- Sem alterações backend necessárias (API já suporta `contactosIds[]`)
- Sem alterações de schema (flag já existe em `uiSettings`)
- Compatível com offline mode (syncManager)
- TanStack Query cache automaticamente invalidado após mutação
