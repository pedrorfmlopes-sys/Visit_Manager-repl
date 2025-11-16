# Commercial Visits Management PWA

## Overview

This is a mobile-first Progressive Web Application (PWA) designed for managing commercial visits to architecture offices (gabinetes). The application enables field sales professionals to efficiently track offices, contacts, and visits, with advanced features including audio transcription, AI-powered visit summaries, automated email notifications, geolocation capture, calendar integration, PDF export, and comprehensive analytics.

The system is built as a full-stack TypeScript application using React for the frontend, Express for the backend, and PostgreSQL with Drizzle ORM for data persistence. It emphasizes mobile usability with Material Design principles and user data isolation for security.

## Recent Updates (November 2025)

**Extended Features Implemented:**
1. ✅ **Geolocation Integration** - Automatic GPS capture during visit creation with validation, LocationPreview component, and map links
2. ✅ **Calendar Integration** - Export visits to .ics files for adding to external calendars (Google Calendar, Outlook, etc.) with sanitized content
3. ✅ **PDF Export** - Generate comprehensive PDF reports for individual visits with sanitized text output
4. ✅ **Advanced Analytics** - User-scoped dashboard with visit trends, top offices, frequency metrics, GPS usage, and performance KPIs using Recharts
5. ✅ **Offline Data Caching** - Complete offline support with IndexedDB storage, automatic sync when back online, and temporary ID management

**Major Backend Migration (November 16, 2025):**
6. ✅ **Universal Entidades System** - Migrated from Gabinetes-only to universal Entidades supporting multiple entity types:
   - **Entity Types**: Gabinete, Cliente, Distribuidor, Obra, Parceiro, Outro
   - **New Fields**: NIF (Portuguese tax number), enhanced address fields, GPS coordinates
   - **Migration Completed**: 2 existing gabinetes migrated to entidades with tipo_entidade="Gabinete"
   - **Backend Complete**: Full CRUD API at `/api/entidades` with validation, safe deletion, and relation checking
   - **Offline Support**: IndexedDB v2 with entidades store, sync manager updated
   - **Data Validation**: Zod schemas with coordinate and NIF validation
   - **Frontend Status**: ⚠️ **Pending Migration** - Forms, lists, and navigation still use old Gabinetes model

**Multi-Agent System with Role-Based Access Control (November 16, 2025):**
7. ✅ **Backend Implementation Complete** - Full role-based access control system:
   - **User Roles**: Admin (sees all data) and Agent (sees only their created/assigned data)
   - **Ownership Fields**: createdByUserId and assignedUserId on entidades, contactos, and visitas
   - **Security**: All UPDATE/DELETE operations enforce ownership checks for agent users
   - **Legacy Support**: Visitas queries include fallback to legacy userId field for historical data access
   - **Storage Layer**: Role-based filtering in all GET methods (admin sees all, agents see owned/assigned)
   - **Odoo Sync Preparation**: Added needsSync, syncStatus, syncError fields with placeholder endpoints
   - **API Endpoints**: POST /api/sync/odoo (manual sync), POST /api/odoo/webhook (incoming updates)
   - **Frontend Status**: ⚠️ **Pending** - Forms need assignedUserId field, offline IndexedDB needs ownership field support

**Offline Capabilities (November 16, 2025):**
- **IndexedDB Storage**: Local database for visits, entidades, gabinetes (deprecated), contactos, and pending sync queue
- **Offline Creation**: Create entidades and contactos while offline → saved locally with temp IDs → appear in lists immediately
- **Automatic Sync**: When back online, pending items automatically sync to server with temp IDs replaced by real server IDs
- **Query Caching**: All server responses (lists and detail fetches) cached to IndexedDB for offline access
- **Smart Fallback**: Forms first attempt online save, automatically fallback to offline if network fails
- **Visual Indicators**: Alert banners show offline status, sync status indicator in UI
- **Edit Restrictions**: Edit operations disabled when offline (with user notification)
- **E2E Tested**: Playwright tests verify offline create → sync → server persistence flow

**Data Security:**
- All visit queries scoped to authenticated user (userId filtering)
- No cross-user data leakage in analytics or visit lists
- Input sanitization for GPS coordinates, ICS files, and PDF content
- Safe deletion: Prevents entidade deletion when related contactos/visitas exist

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Routing**
- React 18 with TypeScript for type-safe component development
- Wouter for lightweight client-side routing
- Vite as the build tool and development server with HMR support
- Mobile-first responsive design targeting smartphone usage

**UI Component System**
- Shadcn/ui component library (New York style) with Radix UI primitives
- Tailwind CSS for utility-first styling with custom design tokens
- Material Design principles optimized for mobile field work
- Bottom navigation pattern for primary app navigation (Dashboard, Gabinetes, Contactos, Visitas)

**State Management**
- TanStack React Query for server state management and caching
- Form state managed with React Hook Form and Zod validation
- Toast notifications for user feedback

**Key Design Patterns**
- Card-based layouts for list views (offices, contacts, visits)
- Search-first interfaces with sticky search bars
- Floating Action Buttons (FAB) for primary creation actions
- Progressive disclosure with empty states and loading skeletons

### Backend Architecture

**Server Framework**
- Express.js with TypeScript for REST API endpoints
- Session-based authentication via express-session with PostgreSQL storage
- Middleware for request logging and JSON parsing

**Authentication Strategy**
- Replit Auth integration using OpenID Connect (OIDC)
- Passport.js for authentication flow management
- Session persistence in PostgreSQL for secure token management
- Protected routes requiring authentication via `isAuthenticated` middleware

**API Structure**
- RESTful endpoints organized by resource:
  - `/api/auth/*` - Authentication and user management
  - `/api/entidades` - **NEW** Universal entity CRUD (Gabinete, Cliente, Distribuidor, Obra, Parceiro, Outro)
  - `/api/gabinetes` - **DEPRECATED** Office CRUD operations (use /api/entidades)
  - `/api/contactos` - Contact CRUD operations
  - `/api/visitas` - Visit CRUD operations with file upload
  - `/api/dashboard` - Aggregated statistics
  - `/api/marcas` - Brand management

**File Upload Handling**
- Multer middleware for multipart form data (audio and images)
- Temporary storage in `/tmp/uploads/` with 50MB file size limit
- Support for multiple media files per visit

### Database Architecture

**ORM & Migrations**
- Drizzle ORM with PostgreSQL dialect
- Type-safe schema definitions with automatic TypeScript inference
- Schema-first approach with Zod validation schemas derived from database schema

**Data Model**
- **Users** - Authentication and profile information (Replit Auth integration)
- **Entidades** (Universal Entities) - Universal entity system supporting multiple types:
  - tipo_entidade: Gabinete | Cliente | Distribuidor | Obra | Parceiro | Outro
  - Fields: nome, morada, cidade, codigo_postal, email, telefone, website, notas, latitude, longitude, nif
  - Replaces Gabinetes as the primary entity model
- **Gabinetes** (DEPRECATED) - Legacy architecture office table, kept for backward compatibility during migration
- **Contactos** (Contacts) - Individual contacts linked to entidades (or legacy gabinetes) with roles and contact details
- **Visitas** (Visits) - Visit records with dates, notes, media attachments, audio transcriptions, and AI summaries
- **Marcas** (Brands) - Product brands that can be associated with entidades and visits
- **Sessions** - Express session storage for authentication state

**Relationships**
- Entidades → Contactos (one-to-many via entidade_id)
- Entidades → Visitas (one-to-many via entidade_id)
- Gabinetes → Contactos (one-to-many via gabinete_id, legacy)
- Gabinetes → Visitas (one-to-many via gabinete_id, legacy)
- Contactos → Visitas (one-to-many)
- Users → Visitas (one-to-many, tracking visit creator)
- Many-to-many relationships for Marcas associations

**Data Integrity**
- Foreign key constraints with cascade delete behavior
- Timestamp tracking (createdAt/updatedAt) on core entities
- JSONB fields for flexible array storage (marcas, mediaUrls)

### External Dependencies

**Third-Party Services**

- **Neon Database** - Serverless PostgreSQL hosting via `@neondatabase/serverless`
  - WebSocket-based connection pooling for scalability
  - Configured via `DATABASE_URL` environment variable

- **OpenAI API** - AI-powered features via official OpenAI SDK
  - Whisper model for audio transcription (`whisper-1`)
  - GPT model for visit summary generation (configured for `gpt-5`)
  - Structured JSON output for visit analysis (needs, opportunities, recommendations)
  - Configured via `OPENAI_API_KEY` environment variable

- **Replit Authentication** - OAuth/OIDC provider integration
  - User profile management with email, name, and profile images
  - Session management with PostgreSQL storage via `connect-pg-simple`
  - Configured via `REPL_ID`, `ISSUER_URL`, and `SESSION_SECRET` environment variables

**Email Integration** (Placeholder Implementation)
- Email notification system prepared for integration with services like Resend or SendGrid
- Currently logs email content to console in development
- Designed to send visit summaries to configured recipients

**UI Component Dependencies**
- Radix UI primitives for accessible, unstyled components (dialogs, popovers, dropdowns, etc.)
- Lucide React for consistent iconography
- date-fns for date formatting and manipulation (Portuguese locale support)
- class-variance-authority and clsx for dynamic className composition

**Development Tools**
- TypeScript for end-to-end type safety
- ESBuild for production server bundling
- Drizzle Kit for database migrations and schema management