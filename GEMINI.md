# Gemini Code Assistant Configuration

## Préférences de l'utilisateur

*   **Langue préférée:** Français

## Détails du projet

*   **Nuxt.js Version:** 4.0.1
*   **Modules Nuxt.js:**
    *   `@nuxt/eslint` ([Documentation](https://eslint.nuxt.com/))
    *   `@nuxt/image` ([Documentation](https://image.nuxt.com/))
    *   `@nuxt/scripts` ([Documentation](https://scripts.nuxt.com/))
    *   `@nuxt/test-utils` ([Documentation](https://test-utils.nuxt.com/))
    *   `@nuxt/ui` (Version 3.3.0) ([Documentation](https://ui.nuxt.com/))
    *   `@pinia/nuxt` ([Documentation](https://pinia.vuejs.org/ssr/nuxt.html))



This file helps Gemini understand the project structure, conventions, and goals to provide more relevant and accurate assistance.

## Project Overview

This is a web application for managing and discovering juggling conventions. Users can register, log in, view a list of conventions, see details for each convention, and add new conventions.

The project is built with the Nuxt.net framework for the frontend and a server-side API built with Nitro (Nuxt's server engine). Prisma is used as the ORM to interact with a database.

## Technologies

*   **Frontend:** [Nuxt.js](https://nuxt.com/) (Vue.js framework)
*   **UI Framework:** [Nuxt UI](https://ui.nuxt.com/)
*   **Backend:** [Nitro](https://nitro.unjs.io/) (Nuxt's server engine)
*   **Database ORM:** [Prisma](https://www.prisma.io/)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Authentication:** JWT-based authentication.

## Project Structure

*   `app/`: Contains the Nuxt.js frontend application.
    *   `components/`: Reusable Vue components.
    *   `pages/`: Application pages and routing.
    *   `stores/`: Pinia stores for state management.
    *   `middleware/`: Nuxt middleware.
*   `server/`: Contains the backend API.
    *   `api/`: API endpoints.
*   `prisma/`: Contains the Prisma schema and migrations.
*   `public/`: Static assets.

## Coding Style & Conventions

*   **Linting:** ESLint is used for linting. The configuration is in `eslint.config.mjs`.
*   **Formatting:** Prettier is recommended for code formatting.
*   **Naming Conventions:**
    *   Components: PascalCase (e.g., `MyComponent.vue`).
    *   Pages: kebab-case (e.g., `my-page.vue`).
    *   API endpoints: kebab-case (e.g., `my-endpoint.post.ts`).

## Common Commands

*   **Install dependencies:** `npm install`
*   **Run development server:** `npm run dev`
*   **Build for production:** `npm run build`
*   **Run database migrations:** `npx prisma migrate dev`
*   **Generate Prisma client:** `npx prisma generate`

## Goals for Gemini

*   Assist in developing new features.
*   Help with debugging and troubleshooting.
*   Write and refactor code following the established conventions.
*   Generate database migrations.
*   Help write tests.
