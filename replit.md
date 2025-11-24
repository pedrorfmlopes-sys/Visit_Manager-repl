# Commercial Visits Management PWA

## Overview
This Progressive Web Application (PWA) streamlines commercial visit management for field sales professionals. It tracks entities, contacts, and visits, offering features like audio transcription, AI-powered summaries, automated email notifications, geolocation, calendar integration, PDF export, and analytics. The application aims to enhance sales team efficiency, data quality, and provide actionable insights. It is a full-stack TypeScript solution with a React frontend, Express backend, and PostgreSQL with Drizzle ORM, built with a mobile-first approach and robust security including user data isolation and Role-Based Access Control (RBAC). The project supports multi-tenant architecture to ensure company isolation.

## User Preferences
Preferred communication style: Simple, everyday language.

## Project Status - Phases Completed

### FASE 1-11 Summary
- FASE 1: Multi-empresa architecture ✅
- FASE 2: 24 API endpoints ✅
- FASE 3: Backoffice Admin API ✅
- FASE 4: Frontend admin backoffice ✅
- FASE 5: Marcas em Visitas ✅
- FASE 6: Áudio com Transcrição por IA ✅
- FASE 9: Tema por Empresa ✅
- FASE 10: Layouts e Navegação por Role ✅
- FASE 11: Filtros Avançados para Visitas/Tarefas ✅
- FASE 12: Agent Bottom Navigation & FAB System ✅

### FASE 13 Implementation (Dashboard Cards CRM para Admin) - COMPLETED 23/11/2025

**Objetivo:** Transformar AdminDashboard numa interface visual com cards CRM clicáveis para acesso rápido a dados relevantes.

**Implementação:**
- Refactored `AdminDashboard.tsx` com nova estrutura de cards
- KPIs mantidos no topo (4 cards: Visitas Hoje, Esta Semana, Tarefas Concluir, Em Atraso)
- 3 novos CRM Cards principais:
  1. **Visitas desta semana** - Clicável para filtros de data (from/to)
  2. **Tarefas em atraso** - Clicável para filtro overdue=true
  3. **Clientes chave (últimos 30 dias)** - Grid de sub-cards por entidade, cada um clicável para filtro entidadeId

**Layout Responsivo:**
- Desktop: 2 cards por linha (cards 1-2), 1 full-width (card 3)
- Mobile: 1 card por linha (stack vertical)

**Cards Features:**
- Hover-elevate feedback visual
- Listas resumidas (max 5 itens) + contador para mais
- Footer "Click para ver todas" com ícone ArrowRight
- Navegação com query params para aplicar filtros automaticamente
- Icons coloridos por card (Calendar verde, AlertCircle vermelho, TrendingUp azul)

**Frontend Calculations (no new backend endpoints):**
- Agrupa visitas/tarefas por semana/atraso/entidade
- Top 5 clientes por contagem de visitas nos últimos 30 dias
- Ordenação por data/contagem

**Result:**
- ✅ Cards CRM visual e interativos
- ✅ Reutiliza `/api/visitas` e `/api/tarefas` com query params
- ✅ Tema (light-business/dark-pro) respeitado
- ✅ Responsivo desktop/mobile
- ✅ Data-testids para automatização

### FASE 15 Implementation (Visit Relationship & History Tracking) - COMPLETED 24/11/2025

**Objetivo:** Implementar sistema de relacionamento e histórico de visitas onde agendamentos podem ser marcados como realizados e gerar novas visitas relacionadas.

**Implementação:**

1. **Database Schema Updates:**
   - Adicionado campo `visitaAnteriorId` na tabela `visitas` para rastrear relacionamento com visita anterior
   - Adicionado campo `mostrarGPS` na tabela `empresas` para controlar visibilidade de GPS (default: false)
   - Relações Drizzle ORM: `visitaAnterior` (one) e `visitasPosteriores` (many) para tracking de histórico

2. **Frontend Features:**
   - **Card "Próxima Visita"** - Mostra data/hora agendada com two action buttons:
     - "Adicionar ao Calendário" - Exporta para calendário
     - "Marcar como Realizado" - Cria nova visita relacionada a partir do agendamento
   - **AI Appointment Flow:**
     - IA gera sugestões de agendamento com data, título e descrição
     - Utilizador clica "Agendar Visita"
     - Dialog permite mudar data/hora da visita agendada
     - PATCH `/api/visitas/:id` atualiza `proximaVisita` da visita atual (não cria nova visita)
     - Card mostra badge com data do agendamento
   - **Mark Completed Flow:**
     - Clica "Marcar como Realizado"
     - POST `/api/visitas` cria nova visita com `dataVisita` = `proximaVisita`
     - Nova visita tem notas com referência à visita anterior
     - Navega automaticamente para a nova visita
     - Assim fica um histórico de visitas relacionadas
   - **GPS Location Card:**
     - Escondido por defecto (comentado com `false &&`)
     - Pode ser habilitado em futuro via setting `empresa.mostrarGPS`
     - Controlado admin settings

3. **Data Flow:**
   - Agendamento: `sugestão IA` → `proximaVisita` field atualizado (PATCH)
   - Realização: `Marcar como Realizado` → nova visita criada com histórico (POST + navegação)
   - Histórico: Visitas ligadas via `visitaAnteriorId` para rastreamento completo

4. **Result:**
   - ✅ Sistema de agendamento integrado na visita (não cria separadamente)
   - ✅ Histórico de visitas relacionadas com `visitaAnteriorId`
   - ✅ "Marcar como Realizado" cria nova visita e navega automaticamente
   - ✅ GPS card desabilitado por defecto (pode ser toggle em future via admin settings)
   - ✅ Database migrada com sucesso
   - ✅ Frontend refetch após agendamento para mostrar card atualizado

## System Architecture

### Frontend Architecture
A mobile-first React 18 application using TypeScript, Wouter for routing, and Vite for bundling. It leverages Shadcn/ui (New York style) with Radix UI and Tailwind CSS, adhering to Material Design principles. State management is handled by TanStack React Query and React Hook Form with Zod for validation. UI patterns emphasize card-based layouts, search-first interfaces, and Floating Action Buttons (FABs). It features adaptive layouts based on user roles (mobile-first for agents with bottom nav, desktop sidebar for admins). Company-specific themes are supported and applied dynamically.

### Backend Architecture
An Express.js application in TypeScript, employing session-based authentication with Replit Auth (OpenID Connect) and Passport.js, storing sessions in PostgreSQL. It provides RESTful APIs for authentication, universal entities, contacts, visits (including file uploads and audio transcription), tasks, and analytics. Multer handles file uploads. A robust RBAC system differentiates Admin (all data access) and Agent (owner/assigned data access) roles, enforcing ownership checks across all data operations.

### Database Architecture
PostgreSQL with Drizzle ORM ensures type-safe schema management. Key entities include Users, a universal Entidades system (e.g., Gabinete, Cliente, Distribuidor), Contactos, Visitas (with media, audio, AI summaries, geolocation, and brands), Tarefas (rich text), Lembretes, Marcas (product brands), and Sessions. Relationships are managed via foreign keys, and data integrity is maintained with timestamp tracking. A `visitasMarcas` junction table manages many-to-many relationships between visits and brands. A `visitasAudio` table stores audio clips for visits, supporting transcription status. The `empresas` table includes a `theme` field for company-wide theme customization and `mostrarGPS` for GPS visibility control.

### System Design Choices

-   **Multi-tenant Architecture**: Supports multiple companies with complete data isolation.
-   **Role-Based Access Control (RBAC)**: Differentiates Admin and Agent roles with granular access control.
-   **Dynamic Theming**: Companies can select a theme (`light-business`, `dark-pro`) that is applied dynamically across the application.
-   **Audio Transcription**: AI-powered audio transcription for visit notes using OpenAI Whisper.
-   **Universal Entidades System**: Flexible system supporting various business entity types.
-   **Rich Text Task Descriptions**: Utilizes TipTap editor for comprehensive formatting, with XSS prevention.
-   **Offline Capabilities**: Comprehensive support with IndexedDB for data caching and automatic synchronization.
-   **Geolocation Integration**: Automatic GPS capture for visits (can be hidden via admin settings).
-   **Calendar Integration**: Generates RFC 5545 compliant `.ics` files.
-   **PDF Export**: Backend-generated PDF reports with photos, AI summaries, and smart pagination.
-   **Advanced Analytics**: RBAC-aware dashboard with KPIs and visualizations.
-   **Universal Contact Recognition Module**: Supports contact import via QR code, vCard, and AI-powered business card scanning.
-   **Google Custom Search Enrichment Module**: Uses Google Custom Search and GPT-4o-mini for company data enrichment.
-   **Intelligent Reminder System**: Proactive engine for visit follow-ups, overdue tasks, and AI-suggested reminders.
-   **PRO Exports Module**: Advanced PDF generation with analytics, charts, and professional executive summaries via OpenAI GPT-4o-mini.
-   **Advanced Filtering**: Comprehensive filtering capabilities for visits and tasks based on various criteria (search, status, date, user, brand, entity).
-   **Visit Relationship Tracking**: System for creating related visits from scheduled appointments, with complete history tracking via `visitaAnteriorId`.

## External Dependencies

-   **Neon Database**: Serverless PostgreSQL hosting.
-   **OpenAI API**: Used for Whisper (audio transcription), GPT-4o-mini (visit summaries, email generation, executive PDF summaries).
-   **Replit Authentication**: OAuth/OIDC provider for user authentication.
-   **Multer**: Handles file uploads.
-   **Radix UI**: UI primitives.
-   **Lucide React**: Iconography.
-   **date-fns**: Date manipulation.
-   **chartjs-node-canvas**: Server-side chart rendering for PDF exports.
-   **DOMPurify**: XSS prevention for rich text.
