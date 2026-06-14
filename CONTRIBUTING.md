# Celluphile 🎬

A personal movie library management app built with Next.js. Track what you own, manage a wishlist, discover something to watch at random, and get recommendations — all with offline support via a service worker and local IndexedDB storage.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running Tests](#running-tests)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | [Auth.js v5](https://authjs.dev/) (Credentials + JWT) |
| Database | MongoDB via Mongoose |
| Offline DB | [Dexie](https://dexie.org/) (IndexedDB wrapper) |
| Movie Data | [TMDB API](https://developer.themoviedb.org/) |
| Validation | [Zod](https://zod.dev/) |
| Unit Tests | Jest + React Testing Library |
| E2E Tests | Cypress |

---

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- A running **MongoDB** instance (local or Atlas)
- A **TMDB API key** (free at [themoviedb.org](https://www.themoviedb.org/settings/api))

---

## Getting Started

```bash
# 1. Clone the repo
git clone <repo-url>
cd celluphile

# 2. Install dependencies
npm install

# 3. Set up environment variables (see below)
cp .env.local.example .env.local

# 4. Run the development server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# MongoDB connection string
MONGODB_URI=mongodb://localhost:27017/celluphile

# Auth.js secret — generate with: openssl rand -base64 32
AUTH_SECRET=your-secret-here

# TMDB API key
TMDB_API_KEY=your-tmdb-api-key

# Web Push (optional — enables push notifications)
# Generate with: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
```

For the **test environment**, create `.env.test.local` (already present, used by Jest and Cypress automatically when `NODE_ENV=test`).

---

## Running Tests

### Unit Tests (Jest)

```bash
# Run all unit tests once
npm test

# Run in watch mode during development
npm run test:watch

# Run only failing tests (clean output, no stack traces)
npm run test:clean
```

Tests live in `__tests__/` mirroring the `app/` directory structure:
- `__tests__/ui/` — React component tests (React Testing Library)
- `__tests__/lib/` — Server-side logic: actions, schemas, TMDB client, notifications

### E2E Tests (Cypress)

```bash
# Open Cypress UI (interactive — starts the dev server automatically)
npm run e2e

# Run all E2E tests headlessly (CI-friendly — starts the dev server automatically)
npm run e2e:headless

# Run a specific spec file
SPEC=cypress/e2e/auth.cy.ts npm run e2e:file

# Run both unit and E2E tests together
npm run test:all
```

Cypress specs live in `cypress/e2e/`:

| Spec | What it covers |
|---|---|
| `auth.cy.ts` | Login, logout, invalid credentials |
| `register-api.cy.ts` | User registration flow |
| `route-protection.cy.ts` | Unauthenticated redirects |
| `dashboard.cy.ts` | Dashboard page rendering |
| `movie-crud.cy.ts` | Add, view, edit, and remove movies |
| `random-movie.cy.ts` | Random movie picker |
| `server-action-security.cy.ts` | Server action auth guards |

---

## Project Structure

```
celluphile/
├── app/
│   ├── (app)/                  # Authenticated route group (shared layout)
│   │   ├── dashboard/          # Home dashboard — recently added movies
│   │   ├── library/            # Full library with filtering, sorting, infinite scroll
│   │   ├── random/             # Random movie picker
│   │   ├── recommendations/    # Recommendation engine
│   │   ├── settings/           # User settings, notifications
│   │   └── wishlist/           # Wishlist management
│   ├── api/
│   │   ├── auth/               # Auth.js route handler
│   │   ├── library/            # REST endpoints for library CRUD
│   │   ├── notifications/      # Web Push subscription & delivery
│   │   ├── register/           # User registration endpoint
│   │   ├── tmdb/               # TMDB search proxy
│   │   └── test/               # Test-only helpers (disabled in prod)
│   ├── lib/
│   │   ├── actions.ts          # All Next.js Server Actions (add, remove, update movie, etc.)
│   │   ├── data.ts             # MongoDB data fetching functions (aggregation pipelines)
│   │   ├── db.ts               # MongoDB client (for Auth.js adapter)
│   │   ├── db-client.ts        # Dexie (IndexedDB) schema & client — offline data layer
│   │   ├── mongoose.ts         # Mongoose connection helper
│   │   ├── schemas.ts          # Zod schemas — single source of truth for validation & types
│   │   ├── tmdb.ts             # TMDB API client
│   │   ├── tmdb-utils.ts       # TMDB data-shaping utilities
│   │   ├── helpers.ts          # Shared utility functions
│   │   ├── hooks/              # Custom React hooks (e.g., online/offline detection)
│   │   └── notifications/      # Web Push sending logic
│   ├── models/
│   │   ├── movie.ts            # Mongoose Movie model (TMDB catalog)
│   │   ├── user.ts             # Mongoose User model
│   │   ├── userMovie.ts        # Mongoose UserMovie model (library entries)
│   │   ├── userWishlist.ts     # Mongoose UserWishlist model
│   │   ├── userEvent.ts        # Mongoose UserEvent model (activity log)
│   │   └── notificationLog.ts  # Mongoose NotificationLog model
│   ├── ui/                     # All React components
│   │   ├── search-add-movie.tsx    # TMDB search + add to library form
│   │   ├── library-filter-and-list.tsx  # Library view with filters, sort, infinite scroll
│   │   ├── item-detail.tsx     # Movie detail modal (edit quality, notes, remove)
│   │   ├── home-dashboard.tsx  # Dashboard — recently added movies
│   │   ├── random-movie.tsx    # Random picker UI
│   │   ├── wishlist-list.tsx   # Wishlist UI
│   │   ├── navigation.tsx      # App navigation bar
│   │   ├── offline-manager.tsx # Offline sync queue manager
│   │   ├── login-form.tsx      # Login form
│   │   ├── register-form.tsx   # Registration form
│   │   └── ...                 # Additional UI components
│   └── login/ register/ offline/  # Public pages
├── __tests__/
│   ├── ui/                     # Jest component tests
│   └── lib/                    # Jest logic/unit tests
├── cypress/
│   ├── e2e/                    # Cypress end-to-end specs
│   ├── fixtures/               # Static test data
│   └── support/                # Custom Cypress commands & setup
├── public/                     # Static assets, service worker (sw.js), PWA icons
├── scripts/                    # Utility scripts (TMDB bulk processing, embeddings, etc.)
├── auth.ts                     # Auth.js configuration (JWT strategy, route protection)
├── next.config.ts              # Next.js config (CSP headers, image domains)
├── jest.config.ts              # Jest configuration
└── cypress.config.ts           # Cypress configuration
```

---

## Architecture Overview

### Authentication

Auth is handled by **Auth.js v5** with a JWT session strategy. Configuration lives in `auth.ts` at the root. Route protection is enforced in the `authorized` middleware callback — protected paths (`/dashboard`, `/library`, `/random`, `/recommendations`, `/settings`, `/wishlist`) redirect unauthenticated users to `/login`. JWT tokens are periodically re-validated against the database (every 5 minutes) to handle deleted user accounts.

### Data Flow

1. **Server Actions** (`app/lib/actions.ts`) are the primary mutation path. They validate input with Zod, interact with MongoDB via Mongoose, and revalidate Next.js cache paths.
2. **Data fetching** (`app/lib/data.ts`) uses MongoDB aggregation pipelines for library queries with filtering, sorting, and cursor-based pagination.
3. **API Routes** (`app/api/`) handle auth callbacks, TMDB search proxying, and push notification subscriptions.

### Offline Support

The app is a **PWA** with a service worker (`public/sw.js`). When offline, reads come from **Dexie** (IndexedDB) and mutations are queued in a `syncQueue` table. The `OfflineManager` component processes the queue when connectivity is restored, replaying operations against the live API.

### Validation

All validation schemas are defined in `app/lib/schemas.ts` using Zod. These are imported by both server actions (for input validation) and client components (for form feedback), making `schemas.ts` the single source of truth for data shapes and types like `Quality`.
