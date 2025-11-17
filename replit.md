# Commercial Visits Management PWA

## Overview

This Progressive Web Application (PWA) facilitates commercial visit management for field sales professionals targeting architecture offices (gabinetes) and other entities. It enables efficient tracking of entities, contacts, and visits, incorporating features like audio transcription, AI-powered visit summaries, automated email notifications, geolocation capture, calendar integration, PDF export, and comprehensive analytics. The application is built as a full-stack TypeScript solution with a React frontend, Express backend, and PostgreSQL with Drizzle ORM, emphasizing mobile-first design, Material Design principles, and robust user data security through isolation and Role-Based Access Control (RBAC). The project aims to provide a comprehensive tool for sales teams to streamline their operations, enhance data quality, and gain actionable insights.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is a mobile-first React 18 application built with TypeScript, utilizing Wouter for routing and Vite for development and bundling. It employs Shadcn/ui (New York style) with Radix UI primitives and Tailwind CSS for styling, adhering to Material Design principles. State management is handled by TanStack React Query for server state and React Hook Form with Zod for form validation. Key UI patterns include card-based layouts, search-first interfaces, and Floating Action Buttons (FABs).

### Backend Architecture

The backend is an Express.js application written in TypeScript. It uses session-based authentication with Replit Auth (OpenID Connect) and Passport.js, storing sessions in PostgreSQL. API endpoints are RESTful, covering authentication, universal entities (`/api/entidades`), contacts, visits (including file uploads), tasks, and analytics. Multer handles file uploads (audio/images) with temporary storage. A robust RBAC system differentiates between Admin (all data access) and Agent (owner/assigned data access) roles, enforcing ownership checks for all data operations.

### Database Architecture

The database uses PostgreSQL with Drizzle ORM for type-safe schema management. The core data model includes:
- **Users**: Authentication and profile information, integrated with Replit Auth.
- **Entidades**: A universal entity system replacing legacy "Gabinetes," supporting types like Gabinete, Cliente, Distribuidor, Obra, Parceiro, Outro, with fields for NIF, address, and GPS coordinates.
- **Contactos**: Contacts linked to entities.
- **Visitas**: Visit records with dates, notes, media attachments, audio transcriptions, AI summaries, and geolocation.
- **Tarefas**: A comprehensive task management system with status, repeat intervals, and optional links to entities/visits.
- **Lembretes**: Intelligent reminder system tracking three types: visit follow-ups (7 days after last visit), overdue tasks, and AI-suggested reminders. Fully RBAC-aware with watertight security.
- **Marcas**: Product brands.
- **Sessions**: For authentication state.
Relationships are managed via foreign keys, and data integrity is maintained with timestamp tracking and JSONB fields for flexible data storage.

### System Design Choices

- **Offline Capabilities**: Comprehensive offline support with IndexedDB for data caching and storage. Automatic synchronization of created entities, contacts, and tasks when online. Query caching allows offline access to previously fetched data.
- **Geolocation Integration**: Automatic GPS capture during visit creation, displayed with map links.
- **Calendar Integration**: Backend-generated, RFC 5545 compliant `.ics` files for visits and tasks, including detailed event data, deep links, and reminders.
- **PDF Export**: Backend-generated PDF reports for visits, including logos, embedded photos, AI summaries, and linked tasks, with smart pagination.
- **Advanced Analytics**: RBAC-aware analytics dashboard providing key performance indicators (KPIs) and visualizations for visits, tasks, entities, and brands, with filtering capabilities.
- **Multi-Agent System with RBAC**: Granular control over data access based on user roles (Admin/Agent), ensuring agents only access their owned or assigned data across entities, contacts, visits, and tasks.
- **Universal Entidades System**: Migration from a "Gabinetes"-only model to a flexible "Entidades" system supporting various business entity types.
- **Universal Contact Recognition Module**: Comprehensive contact import system with three methods:
  1. **QR Code Scanner**: Scans QR codes containing vCard data
  2. **vCard Parser**: Imports .vcf files with full vCard 3.0/4.0 support
  3. **Business Card Vision Scanner**: AI-powered extraction from business card photos using OpenAI gpt-4o vision API
  All three methods utilize universal auto-creation logic that intelligently matches or creates entities based on organization name and domain, with full RBAC enforcement and offline queue support.
- **Intelligent Reminder System**: Proactive reminder engine generating three types of notifications:
  1. **Visit Follow-ups**: Automatically suggests follow-up visits 7 days after the last visit to an entity
  2. **Overdue Tasks**: Alerts users about pending tasks past their due date
  3. **AI-Suggested Reminders**: Future capability for intelligent reminder suggestions
  Reminders are RBAC-aware with watertight security - agents see only reminders for their assigned entities and tasks. Features include snooze (1, 3, 7 days), resolve, and reminder banners integrated into entity and visit detail pages. Real-time badge counts in navigation bell icon.

## External Dependencies

- **Neon Database**: Serverless PostgreSQL hosting for production data persistence.
- **OpenAI API**: Utilized for AI-powered features, including Whisper for audio transcription and GPT for visit summary generation.
- **Replit Authentication**: OAuth/OIDC provider for user authentication and profile management.
- **Email Integration**: Prepared for services like Resend or SendGrid for automated email notifications (currently console logging in development).
- **UI Component Dependencies**: Radix UI primitives, Lucide React for iconography, date-fns for date manipulation.