# Commercial Visits Management PWA

## Overview
This Progressive Web Application (PWA) streamlines commercial visit management for field sales professionals. It tracks entities, contacts, and visits, offering features like audio transcription, AI-powered summaries, automated email notifications, geolocation, calendar integration, PDF export, and analytics. The application aims to enhance sales team efficiency, data quality, and provide actionable insights. It is a full-stack TypeScript solution with a React frontend, Express backend, and PostgreSQL with Drizzle ORM, built with a mobile-first approach and robust security including user data isolation and Role-Based Access Control (RBAC). The project supports multi-tenant architecture to ensure company isolation.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
A mobile-first React 18 application using TypeScript, Wouter for routing, and Vite for bundling. It leverages Shadcn/ui (New York style) with Radix UI and Tailwind CSS, adhering to Material Design principles. State management is handled by TanStack React Query and React Hook Form with Zod for validation. UI patterns emphasize card-based layouts, search-first interfaces, and Floating Action Buttons (FABs). It features adaptive layouts based on user roles (mobile-first for agents with bottom nav, desktop sidebar for admins). Company-specific themes are supported and applied dynamically.

### Backend Architecture
An Express.js application in TypeScript, employing session-based authentication with Replit Auth (OpenID Connect) and Passport.js, storing sessions in PostgreSQL. It provides RESTful APIs for authentication, universal entities, contacts, visits (including file uploads and audio transcription), tasks, and analytics. Multer handles file uploads. A robust RBAC system differentiates Admin (all data access) and Agent (owner/assigned data access) roles, enforcing ownership checks across all data operations.

### Database Architecture
PostgreSQL with Drizzle ORM ensures type-safe schema management. Key entities include Users, a universal Entidades system (e.g., Gabinete, Cliente, Distribuidor), Contactos, Visitas (with media, audio, AI summaries, geolocation, and brands), Tarefas (rich text), Lembretes, Marcas (product brands), and Sessions. Relationships are managed via foreign keys, and data integrity is maintained with timestamp tracking. A `visitasMarcas` junction table manages many-to-many relationships between visits and brands. A `visitasAudio` table stores audio clips for visits, supporting transcription status. The `empresas` table includes a `theme` field for company-wide theme customization.

### System Design Choices

-   **Multi-tenant Architecture**: Supports multiple companies with complete data isolation.
-   **Role-Based Access Control (RBAC)**: Differentiates Admin and Agent roles with granular access control.
-   **Dynamic Theming**: Companies can select a theme (`light-business`, `dark-pro`) that is applied dynamically across the application.
-   **Audio Transcription**: AI-powered audio transcription for visit notes using OpenAI Whisper.
-   **Universal Entidades System**: Flexible system supporting various business entity types.
-   **Rich Text Task Descriptions**: Utilizes TipTap editor for comprehensive formatting, with XSS prevention.
-   **Offline Capabilities**: Comprehensive support with IndexedDB for data caching and automatic synchronization.
-   **Geolocation Integration**: Automatic GPS capture for visits.
-   **Calendar Integration**: Generates RFC 5545 compliant `.ics` files.
-   **PDF Export**: Backend-generated PDF reports with photos, AI summaries, and smart pagination.
-   **Advanced Analytics**: RBAC-aware dashboard with KPIs and visualizations.
-   **Universal Contact Recognition Module**: Supports contact import via QR code, vCard, and AI-powered business card scanning.
-   **Google Custom Search Enrichment Module**: Uses Google Custom Search and GPT-4o-mini for company data enrichment.
-   **Intelligent Reminder System**: Proactive engine for visit follow-ups, overdue tasks, and AI-suggested reminders.
-   **PRO Exports Module**: Advanced PDF generation with analytics, charts, and professional executive summaries via OpenAI GPT-4o-mini.
-   **Advanced Filtering**: Comprehensive filtering capabilities for visits and tasks based on various criteria (search, status, date, user, brand, entity).

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