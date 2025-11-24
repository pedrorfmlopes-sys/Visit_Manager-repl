# Commercial Visits Management PWA

## Overview
This Progressive Web Application (PWA) is designed to enhance the efficiency of field sales professionals by streamlining commercial visit management. It provides a comprehensive solution for tracking entities, contacts, and visits, featuring AI-powered summaries, audio transcription, automated notifications, geolocation, calendar integration, PDF export, and analytics. The application aims to improve data quality and provide actionable insights for sales teams. It is a full-stack TypeScript solution with a React frontend, Express backend, and PostgreSQL with Drizzle ORM, built with a mobile-first approach, multi-tenant architecture, and robust security including user data isolation and Role-Based Access Control (RBAC).

## User Preferences
Preferred communication style: Simple, everyday language.

## Project Status - FASE 20 IMPLEMENTED

### FASE 20: Refactor "Próxima Visita Agendada" para Fluxo Unificado de "Atualizar Estado" - COMPLETED 24/11/2025

**Objetivo:** Substituir botões dispersos (X e "Marcar como Realizado") por um único botão "Atualizar estado" com modal de 3 opções e badge de "Agendamento em atraso".

**Implementação:**

1. **Novo Componente `UpdateVisitStatusDialog.tsx`:**
   - Novo ficheiro: `client/src/components/UpdateVisitStatusDialog.tsx`
   - Modal com 3 opções visuais (cards clicáveis)
   - Step-by-step UX para cada ação
   - Data-testids completos para QA

2. **Opção 1 - Criar Nova Visita (Follow-up):**
   - Reutiliza lógica existente de FASE 15
   - Navega para `/visitas/nova` com query params pré-preenchidos
   - Parâmetros: `visitaAnteriorId`, `dataVisita`, `entidadeId`, `contactoId`, etc.
   - Mantém chain de follow-ups via `visitaAnteriorId`
   - Data-testid: `button-confirm-follow-up`

3. **Opção 2 - Só Marcar como Realizada (Sem Follow-up Automático):**
   - Input de data/hora (default para agora)
   - Checkbox opcional: "Associar a outra visita desta entidade"
   - Se ativo, dropdown de visitas relacionadas (carregadas via `GET /api/visitas?entidadeId=...`)
   - PATCH no backend:
     - `dataVisita`: data em que foi realmente realizada
     - `proximaVisita`: null (remove agendamento)
     - `visitaAnteriorId`: visita selecionada (opcional)
   - Data-testids: `input-realized-date`, `checkbox-associate-visita`, `select-related-visita`, `button-confirm-mark-done`

4. **Opção 3 - Cancelar Agendamento:**
   - Confirmação clara: "Isto irá remover apenas a informação de próxima visita. Nenhuma visita será criada ou eliminada."
   - PATCH no backend: `proximaVisita: null`
   - Sem apagar registos, apenas limpa campo
   - Data-testid: `button-confirm-cancel`

5. **Badge "Agendamento em Atraso":**
   - Modificado: `client/src/pages/VisitaDetail.tsx` (linhas ~1182-1186)
   - Verifica: `isBefore(dataVisita, startOfDay(hoje))` 
   - Badge vermelho (destructive) com AlertTriangle icon
   - Renderizado no CardTitle do card "Próxima Visita Agendada"
   - Data-testid: `badge-overdue-appointment`

6. **Modificações em VisitaDetail.tsx:**
   - Removido botão X direto (remoção imediata)
   - Removido botão "Marcar como Realizado" direto
   - Adicionado novo botão "Atualizar Estado" (primary variant, tamanho sm)
   - Botão navega para `setUpdateStatusDialogOpen(true)`
   - Botão "Ir para a Visita Realizada" mantém-se se `visitasPosteriores` existem
   - Data-testid: `button-update-visit-status`
   - Integração: `<UpdateVisitStatusDialog open={updateStatusDialogOpen} onOpenChange={setUpdateStatusDialogOpen} visita={visita} onSuccess={...} />`

**Fluxo UX:**

1. Utilizador vê card "Próxima Visita Agendada"
   - Se data < hoje: Badge vermelho "Em Atraso"
2. Clica em "Atualizar Estado"
3. Modal abre com 3 cards de opções (cada um clicável)
4. Utilizador escolhe uma:
   - **Follow-up**: Vê resumo (data agendada), clica "Criar Follow-up" → navega para nova visita
   - **Só Marcar**: Preenche data + (opcionalmente) associa outra visita → clica "Marcar como Realizada" → PATCH + fecha modal
   - **Cancelar**: Confirmação → PATCH `proximaVisita: null` → fecha modal
5. Backend PATCH aplica apenas alterações necessárias
6. Frontend invalida queries e card desaparece ou atualiza

**Backend (Sem novos Endpoints):**

- PATCH `/api/visitas/:id` aceita novos payloads:
  ```typescript
  {
    dataVisita?: Date,
    proximaVisita?: null,
    visitaAnteriorId?: string
  }
  ```
- Backend já suporta estes campos, sem mudanças necessárias
- RBAC mantém-se (user ownership checks já existem)

**Data-Testids Completos (QA):**

- `badge-overdue-appointment` - Badge agendamento em atraso
- `button-update-visit-status` - CTA principal "Atualizar estado"
- `button-back-options`, `button-back-options-2`, `button-back-options-3` - Voltar entre steps
- `button-confirm-follow-up` - Confirmar follow-up
- `input-realized-date` - Data realizada
- `checkbox-associate-visita` - Checkbox associação
- `select-related-visita` - Dropdown de visitas relacionadas
- `button-confirm-mark-done` - Confirmar marcar realizada
- `button-confirm-cancel` - Confirmar cancelar agendamento

**Cenários Testados:**

| Cenário | Ação | Resultado Esperado |
|---------|------|-------------------|
| Visita com agendamento | Clicar "Atualizar estado" | Modal abre com 3 opções |
| Selecionar Follow-up | Confirmar | Navega para nova visita pré-preenchida |
| Selecionar Só Marcar | Preencher data + (opcionalmente) associar | PATCH atualiza `dataVisita` + limpa `proximaVisita` + linksa `visitaAnteriorId` |
| Selecionar Cancelar | Confirmar | PATCH limpa `proximaVisita` apenas |
| Agendamento no passado | Ver card | Badge vermelho "Em Atraso" visível |

**Result:**

- ✅ Card refatorado com novo botão "Atualizar estado"
- ✅ Modal com 3 opções de ação bem diferenciadas
- ✅ Badge "Agendamento em atraso" para datas passadas
- ✅ Sem apagar nada por acidente (confirmações claras)
- ✅ Reutiliza lógica FASE 15 (follow-ups)
- ✅ Sem novos endpoints backend
- ✅ RBAC respeitado (API filtra por empresaId)
- ✅ UX clara e step-by-step

---

## Previous Phases Summary

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
-   **Unified Visit Status Management**: Consolidated "Atualizar Estado" dialog with 3 distinct action paths (follow-up, mark done only, cancel appointment) for scheduled visits, with overdue status detection.

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
