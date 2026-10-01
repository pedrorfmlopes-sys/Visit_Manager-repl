# Commercial Visits Management PWA

## Overview
This Progressive Web Application (PWA) aims to revolutionize commercial visit management for field sales professionals. It provides tools for tracking entities, contacts, and visits, enhanced with AI-powered summaries, audio transcription, automated notifications, geolocation, calendar integration, PDF export, and advanced analytics. The project's core mission is to improve data quality and deliver actionable insights to sales teams. It's a full-stack TypeScript solution featuring a React frontend, Express backend, and PostgreSQL with Drizzle ORM, built with a mobile-first, multi-tenant architecture, user data isolation, and Role-Based Access Control (RBAC).

## User Preferences
- Preferred communication style: Simple, everyday language.
- **MANDATORY: Create a detailed report (Resumo_*.md) after EVERY prompt/step until user says otherwise.**
- Follow prompts EXACTLY without adding extra features or "inventions"
- Always use test IDs and comprehensive documentation

## System Architecture

### Frontend Architecture
A mobile-first React 18 application built with TypeScript, Wouter for routing, and Vite. It uses Shadcn/ui (New York style) based on Radix UI and Tailwind CSS, following Material Design principles. State management is handled by TanStack React Query, and form validation by React Hook Form with Zod. UI emphasizes card-based layouts, search-first interfaces, and Floating Action Buttons (FABs), supporting adaptive layouts for various user roles and dynamic company-specific themes.

### Backend Architecture
An Express.js application in TypeScript, using session-based authentication via Replit Auth (OpenID Connect) and Passport.js, with sessions stored in PostgreSQL. It offers RESTful APIs for authentication, universal entities, contacts, visits (supporting file uploads and audio transcription), tasks, and analytics. Multer handles file uploads. A robust RBAC system enforces data access based on Admin (full access) and Agent (owner/assigned data access) roles.

### Database Architecture
PostgreSQL with Drizzle ORM provides type-safe schema management. Key entities include Users, a universal `Entidades` system, Contactos, Visitas (with media, audio, AI summaries, geolocation, and brands), Tarefas, Lembretes, Marcas, and Sessions. Relationships are managed through foreign keys. The `empresas` table includes `theme`, `mostrarGPS`, `crmLeadsEnabled` for module control, and `openai_api_key` for company-specific OpenAI API keys. `entidade_tipos` allows for flexible, company-configurable entity categorization. `visitasContactos` manages many-to-many relationships between visits and contacts.

### System Design Choices
-   **Multi-tenant Architecture**: Ensures complete data isolation for multiple companies.
-   **Role-Based Access Control (RBAC)**: Provides granular access for Admin and Agent roles.
-   **Dynamic Theming**: Allows company-specific configurable themes.
-   **AI-powered Features**: Includes audio transcription, visit summaries, and executive PDF summaries.
-   **Universal Entidades System**: Offers flexible, company-configurable business entity types.
-   **Offline Capabilities**: Utilizes data caching with IndexedDB and automatic synchronization.
-   **Geolocation Integration**: Captures GPS data for visits and provides proximity suggestions.
-   **Calendar Integration**: Generates RFC 5545 compliant `.ics` files.
-   **PDF Export**: Generates backend reports with photos, AI summaries, and smart pagination.
-   **Advanced Analytics**: Features an RBAC-aware dashboard with KPIs and AI insights.
-   **Configurable Entity Types**: Enables company-specific entity type management with color coding and filtering.
-   **Multi-Contact Support for Visits**: Supports associating multiple contacts per visit, with a toggle for single vs. multi-contact mode.
-   **Company-level AI Configuration**: Supports global or "Bring Your Own Key" (BYOK) OpenAI API key usage, with secure storage.
-   **Feature Toggle System**: Implements global toggles (e.g., `crmLeadsEnabled`) for module control across all UI layers.

## External Dependencies

-   **Neon Database**: Serverless PostgreSQL hosting.
-   **OpenAI API**: Used for Whisper (audio transcription) and GPT-4o-mini (visit summaries, email generation, executive PDF summaries).
-   **Replit Authentication**: OAuth/OIDC provider for user authentication.
-   **Multer**: Handles file uploads.
-   **Radix UI**: Provides UI primitives.
-   **Lucide React**: For iconography.
-   **date-fns**: Used for date manipulation.
-   **chartjs-node-canvas**: For server-side chart rendering in PDF exports.
-   **DOMPurify**: For XSS prevention in rich text content.