# Commercial Visits Management PWA

## Overview
This Progressive Web Application (PWA) is designed to streamline commercial visit management for field sales professionals. It tracks entities, contacts, and visits, providing AI-powered summaries, audio transcription, automated notifications, geolocation, calendar integration, PDF export, and analytics. The application aims to enhance data quality and deliver actionable insights to sales teams. It is a full-stack TypeScript solution featuring a React frontend, Express backend, and PostgreSQL with Drizzle ORM, built with a mobile-first, multi-tenant architecture and robust security, including user data isolation and Role-Based Access Control (RBAC).

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
A mobile-first React 18 application built with TypeScript, Wouter for routing, and Vite. It leverages Shadcn/ui (New York style) with Radix UI and Tailwind CSS, adhering to Material Design principles. State management utilizes TanStack React Query, and form validation is handled by React Hook Form with Zod. UI patterns emphasize card-based layouts, search-first interfaces, and Floating Action Buttons (FABs). It supports adaptive layouts for different user roles (mobile-first for agents with a bottom navigation, desktop sidebar for admins, and a mobile drawer for admins on small screens). Company-specific themes are dynamically applied.

### Backend Architecture
An Express.js application developed in TypeScript. It uses session-based authentication via Replit Auth (OpenID Connect) and Passport.js, with sessions stored in PostgreSQL. It provides RESTful APIs for authentication, universal entities, contacts, visits (including file uploads and audio transcription), tasks, and analytics. Multer is used for file uploads. A robust RBAC system differentiates Admin (full data access) and Agent (owner/assigned data access) roles, enforcing ownership checks across all data operations.

### Database Architecture
PostgreSQL with Drizzle ORM is used for type-safe schema management. Core entities include Users, a universal `Entidades` system (e.g., Gabinete, Cliente, Distribuidor), Contactos, Visitas (with media, audio, AI summaries, geolocation, and brands), Tarefas (rich text), Lembretes, Marcas (product brands), and Sessions. Relationships are managed through foreign keys. The `visitasMarcas` junction table handles many-to-many relationships. `visitasAudio` stores audio clips. The `empresas` table includes `theme` for customization and `mostrarGPS` for GPS visibility. `visitaAnteriorId` in `visitas` tracks historical visit relationships. The `entidade_tipos` table allows company-configurable entity types for flexible categorization and filtering.

### System Design Choices
-   **Multi-tenant Architecture**: Supports multiple companies with complete data isolation.
-   **Role-Based Access Control (RBAC)**: Granular access control for Admin and Agent roles.
-   **Dynamic Theming**: Configurable themes per company (`light-business`, `dark-pro`).
-   **AI-powered Features**: Audio transcription, visit summaries, and executive PDF summaries.
-   **Universal Entidades System**: Flexible system for various business entity types, configurable per company.
-   **Rich Text Editor**: TipTap editor for tasks with XSS prevention.
-   **Offline Capabilities**: Data caching with IndexedDB and automatic synchronization.
-   **Geolocation Integration**: Automatic GPS capture for visits and proximity suggestions.
-   **Calendar Integration**: Generates RFC 5545 compliant `.ics` files.
-   **PDF Export**: Backend-generated reports with photos, AI summaries, and smart pagination.
-   **Advanced Analytics**: RBAC-aware dashboard with KPIs and visualizations, including AI insights.
-   **Universal Contact Recognition**: Supports QR code, vCard, and AI business card scanning for contact import.
-   **Intelligent Reminder System**: Proactive engine for follow-ups, overdue tasks, and AI-suggested reminders.
-   **PRO Exports Module**: Advanced PDF generation with analytics, charts, and AI-powered executive summaries.
-   **Advanced Filtering**: Comprehensive filtering for visits and tasks with UI settings control.
-   **Visit Relationship Tracking**: Tracks related visits and appointment history.
-   **Full CRUD Operations**: Complete Edit and Delete UI for all entities with role-based access.
-   **Responsive Admin Layout**: Desktop sidebar adapts to a mobile drawer.
-   **AI-to-Task Conversion**: One-click conversion of AI suggestions to system tasks.
-   **Real-time Alerts & Badges**: Visual notifications for pending/overdue tasks and today's visits.
-   **Unified Visit Status Management**: Consolidated dialog for managing scheduled visit statuses.
-   **Persistent AI Suggestions**: Maintains state of linked tasks/visits from AI suggestions across reloads.
-   **Admin Settings Center**: Organized settings with company configuration, logo upload, and UI settings JSON.
-   **Configurable Entity Types**: Company-specific entity type management with color coding and filtering.

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
### FASE 30: Ícones Configuráveis por Tipo de Entidade (✅ Completo)
- **Schema**: Campo `icon` varchar(50) default "Building2" adicionado a `entidade_tipos`
- **Zod Validation**: Enum com 8 ícones suportados (Building2, Store, Factory, Briefcase, Users, Home, Handshake, Package)
- **AdminEntidadeTipos**: Select dropdown para escolher ícone, visual preview na lista
- **EntidadeCard**: Usa `entidade.entidadeTipo.icon` para renderizar ícone dinamicamente
- **EntidadeDetail**: Badge mostra ícone + nome do tipo
- **Status**: ✅ Sistema completo, 77 linhas adicionadas, testes OK

### FASE 30.1: Corrigir Erro 400 ao Criar Tipo com Ícone (✅ Completo)
- **Erro Root Cause**: Coluna `icon` não estava sincronizada com BD PostgreSQL
- **Solução**: Execução de `npm run db:push` para migrar schema Drizzle
- **Verificação**: Schema Zod + routes + storage estavam corretos desde o início
- **Resultado**: Criação de tipos com ícone 100% funcional, 6 testes passados
- **Status**: ✅ Migração executada, app restarted, sistema operacional

### FASE 33: Sistema de Secções com Query Parameters (✅ Completo)
- **Objetivo**: Refactor AdminEmpresa.tsx com navegação hierárquica de 5 secções principais
- **Arquitetura**: Query params navigation (?section=empresa|visitas|ia|alertas|integracoes)
- **Secções Implementadas**:
  1. **Empresa & Equipa**: Geral (info + tema/logo), Marcas & Entidades (AdminMarcas + AdminEntidadeTipos), Utilizadores (AdminUsers)
  2. **Visitas & Tarefas**: Comportamento (marcas, follow-ups), Filtros & Listas (13 filtros por módulo)
  3. **IA & Produtividade**: IA Visitas (insights, resumos, sugestões), Áudio & Transcrição (gravação, transcrição, idioma)
  4. **Alertas & Relatórios**: Alertas & UX (ribbons, badges, intervalo), Localização (GPS, privacidade)
  5. **Integrações**: Microsoft 365, Google, Outros (placeholders)
- **Filtros Avançados Implementados** (13 totais):
  - Entidades: Tipo de Entidade, Pesquisa
  - Contactos: Entidade, Cargo, Pesquisa
  - Visitas: Datas, Utilizador, Marca, Entidade, Contacto, Áudio
  - Tarefas: Status, Overdue, Utilizador Atribuído, Entidade, Visita
- **Mudanças AdminSidebar**: Menu dropdown consolidado com 5 items + ícones (Building2, Calendar, Lightbulb, Bell, Zap)
- **Stats**: AdminSidebar 218 linhas, AdminEmpresa ~600 linhas, 0 LSP errors, 5 secções, 8+ tabs internos
- **Status**: ✅ Completo, testes navegação OK, query params funcional, UI consolidada

