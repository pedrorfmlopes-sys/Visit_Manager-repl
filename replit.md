# Commercial Visits Management PWA

## Overview
This Progressive Web Application (PWA) streamlines commercial visit management for field sales professionals. It tracks entities, contacts, and visits, offering features like audio transcription, AI-powered summaries, automated email notifications, geolocation, calendar integration, PDF export, and analytics. The application aims to enhance sales team efficiency, data quality, and provide actionable insights. It is a full-stack TypeScript solution with a React frontend, Express backend, and PostgreSQL with Drizzle ORM, built with a mobile-first approach and robust security including user data isolation and Role-Based Access Control (RBAC). The project supports multi-tenant architecture to ensure company isolation.

## User Preferences
Preferred communication style: Simple, everyday language.

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