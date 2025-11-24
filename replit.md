# Commercial Visits Management PWA

## Overview
This Progressive Web Application (PWA) is designed to optimize commercial visit management for field sales professionals. It provides comprehensive tools for tracking entities, contacts, and visits, enhanced with AI-powered summaries, audio transcription, automated notifications, geolocation, calendar integration, PDF export, and advanced analytics. The application aims to significantly improve data quality and provide actionable insights for sales teams. It is built as a full-stack TypeScript solution, featuring a React frontend, an Express backend, and PostgreSQL with Drizzle ORM. Key architectural principles include a mobile-first approach, multi-tenancy with strict user data isolation, and robust Role-Based Access Control (RBAC).

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
A mobile-first React 18 application built with TypeScript, utilizing Wouter for routing and Vite for tooling. It incorporates Shadcn/ui (New York style) with Radix UI and Tailwind CSS, adhering to Material Design principles. State management is handled by TanStack React Query, and form validation uses React Hook Form with Zod. UI patterns emphasize card-based layouts, search-first interfaces, and Floating Action Buttons (FABs). Adaptive layouts are implemented based on user roles, supporting company-specific themes dynamically.

### Backend Architecture
An Express.js application developed in TypeScript. It uses session-based authentication via Replit Auth (OpenID Connect) and Passport.js, with sessions stored in PostgreSQL. The backend provides RESTful APIs for authentication, universal entities, contacts, visits (including file uploads and audio transcription), tasks, and analytics. Multer is used for file uploads. A robust RBAC system distinguishes between Admin (full data access) and Agent (owner/assigned data access) roles, enforcing ownership checks across all data operations.

### Database Architecture
PostgreSQL with Drizzle ORM provides type-safe schema management. Core entities include Users, a universal `Entidades` system (e.g., Gabinete, Cliente, Distribuidor), Contactos, Visitas (with associated media, audio, AI summaries, geolocation, and brands), Tarefas (rich text), Lembretes, Marcas, and Sessions. Relationships are managed through foreign keys, including a `visitasMarcas` junction table for many-to-many relationships and a `visitasAudio` table for audio clips. The `empresas` table supports dynamic theming and GPS visibility control. A `visitaAnteriorId` field tracks historical visit relationships. Additionally, a new `entidade_tipos` table allows for company-configurable entity types.

### System Design Choices
The system supports a multi-tenant architecture with complete data isolation and granular Role-Based Access Control (RBAC). It features dynamic company theming, AI-powered audio transcription for visit notes, and a universal `Entidades` system for flexible business entity management. Rich text task descriptions are supported with XSS prevention. The application offers comprehensive offline capabilities with IndexedDB for data caching and automatic synchronization. Geolocation integration automatically captures GPS for visits, and calendar integration generates RFC 5545 `.ics` files. Backend-generated PDF reports include photos, AI summaries, and smart pagination. Advanced analytics dashboards are RBAC-aware. Other features include a universal contact recognition module (QR, vCard, AI business card scanning), Google Custom Search enrichment, an intelligent reminder system, and advanced "PRO" PDF exports with AI-driven executive summaries. The system includes advanced filtering, visit relationship tracking, full CRUD operations with RBAC, and a responsive admin layout. AI suggestions can be converted directly into tasks with pre-filled forms. Real-time alerts and badges provide visual notifications. A unified visit status management system handles scheduled appointments, including overdue detection. AI suggestions are persistent across sessions. An Admin Settings Center allows for company configuration, logo uploads, and UI settings. GPS-based proximity visit suggestions are provided to agents, with a configurable feature toggle for AI insights. User-specific settings are managed via a dedicated profile page. An onboarding dashboard, activity logs, and admin debug tools enhance usability and maintenance. Configurable entity types allow for flexible categorization and filtering of visits.

## External Dependencies

-   **Neon Database**: Serverless PostgreSQL hosting.
-   **OpenAI API**: Used for Whisper (audio transcription) and GPT-4o-mini (visit summaries, email generation, executive PDF summaries).
-   **Replit Authentication**: OAuth/OIDC provider for user authentication.
-   **Multer**: Handles file uploads.
-   **Radix UI**: UI primitives.
-   **Lucide React**: Iconography.
-   **date-fns**: Date manipulation and timezone-aware comparisons.
-   **chartjs-node-canvas**: Server-side chart rendering for PDF exports.
-   **DOMPurify**: XSS prevention for rich text.