# Repository Guidelines

## Project Structure & Module Organization

The main application is a Next.js 16 App Router project. Pages, layouts, and API handlers live in `src/app/`; reusable UI is in `src/components/`, shared server/client utilities in `src/lib/`, hooks in `src/hooks/`, and common types in `src/types/`. Static assets belong in `public/`. Database definitions and chronological migrations are under `supabase/`. Content research is stored in `wiki-content/`, while operational scripts live in `scripts/`. The separate `services/pi-gateway/` package has its own `AGENTS.md`; follow that guide when editing the gateway.

## Build, Test, and Development Commands

- `npm install`: install root dependencies.
- `npm run dev`: start the local site at `http://localhost:3000`.
- `npm run lint`: run the Next.js ESLint configuration.
- `npm test`: execute all Vitest tests once.
- `npm run test:coverage`: generate text and HTML V8 coverage reports.
- `npm run build`: perform the production Next.js and TypeScript build.
- `npm run import:post -- "/path/article.md"`: import one Markdown article.

Before handing off changes, run `npm run lint`, `npm test`, and `npm run build`.

## Coding Style & Naming Conventions

Use strict TypeScript and the `@/*` alias for imports from `src/`. Follow nearby formatting: two-space indentation, single quotes, and omitted semicolons in most TS/TSX files. Name React components and their files in PascalCase (`ArticleListItem.tsx`), hooks with a `use` prefix, and utilities in kebab-case. Keep route handlers in App Router `route.ts` files. Prefer small, typed helpers and avoid duplicating content-type or author normalization logic already available in `src/lib/`.

## Testing Guidelines

Vitest runs in the Node environment. Place tests beside the implementation using `*.test.ts`, as in `src/lib/author.test.ts` and API `route.test.ts` files. Cover success, validation, authorization, and failure paths for API changes. No numeric coverage threshold is enforced; maintain or improve coverage for touched behavior.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commit-style subjects such as `feat:`, `fix:`, `style:`, `ci:`, and `chore:`. Keep commits focused and use an imperative, concise subject. Pull requests should explain behavior and database/configuration impact, link relevant issues, list verification commands, and include screenshots for visible UI changes. Call out required files from `supabase/migrations/` explicitly.

## Security & Configuration

Copy `.env.example` to `.env.local`; never commit credentials. Treat Supabase service-role keys, Resend keys, confirmation secrets, and agent secrets as server-only. Apply existing-environment migrations in filename order instead of rerunning `supabase/schema.sql`.
