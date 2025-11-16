# Commercial Visits Management PWA

## Overview

This is a mobile-first Progressive Web Application (PWA) designed for managing commercial visits to architecture offices (gabinetes). The application enables field sales professionals to efficiently track offices, contacts, and visits, with advanced features including audio transcription, AI-powered visit summaries, and automated email notifications.

The system is built as a full-stack TypeScript application using React for the frontend, Express for the backend, and PostgreSQL with Drizzle ORM for data persistence. It emphasizes mobile usability with Material Design principles and provides offline-capable PWA functionality.

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
  - `/api/gabinetes` - Office CRUD operations
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
- **Gabinetes** (Offices) - Architecture office details with address, contact info, and brand associations
- **Contactos** (Contacts) - Individual contacts linked to offices with roles and contact details
- **Visitas** (Visits) - Visit records with dates, notes, media attachments, audio transcriptions, and AI summaries
- **Marcas** (Brands) - Product brands that can be associated with offices and visits
- **Sessions** - Express session storage for authentication state

**Relationships**
- Gabinetes → Contactos (one-to-many)
- Gabinetes → Visitas (one-to-many)
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