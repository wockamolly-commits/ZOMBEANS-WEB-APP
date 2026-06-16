# Zombeans Web

> Rise Up From The Dead. The Zombeans Café ordering platform.

Production-ready ordering for **dine-in, pickup, and delivery** in San Carlos City. Built with Next.js + Supabase + Tailwind v4 + shadcn/ui.

See [`zombeans-plan.md`](./zombeans-plan.md) for the full system design, schema, roadmap, and locked decisions.

## Phase 0 — current state

What's wired:

- Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui (Base UI variant)
- Brand tokens (deep forest, sage, cream, bone) + Anton/Inter/JetBrains Mono fonts
- Doodle SVG accent system
- Folder structure per plan §6
- Logo + 30 drink photos + 31 food photos in `public/images/`
- Supabase migrations 0001–0009 (schema + RLS + RPCs)
- `supabase/seed.sql` — 12 categories, ~50 items, all variations, modifier groups
- Static home / menu / about / contact pages rendering against `lib/menu-static.ts`
- All routes prerender; `npm run build` is green

What's stubbed for later phases:

- Supabase project (migrations are written but not yet deployed)
- Auth (admin/staff/rider)
- Cart, checkout, order tracking
- Admin dashboard
- Rider app
- PayMongo, Loyverse, Resend, Google Maps integrations (deferred per plan §13.2)

## Local dev

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Project layout

See [`zombeans-plan.md`](./zombeans-plan.md) §6.
