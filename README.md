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

## Admin authentication

- Customers sign in at `/login` with a Supabase email link.
- The Super Admin and invited staff sign in at `/admin/login`.
- Set `SUPER_ADMIN_EMAIL` to the one primary Super Admin address.
- Apply Supabase migration `0023_admin_magic_link_reset.sql` before using the
  redesigned flow.
- The Super Admin invites staff from `/workspace/team`; invitations expire
  after 48 hours and can only create `staff` accounts.
- Customer and admin sessions use separate cookie namespaces. Admin routes
  also re-check the active database role on every request.
- Staff may order normally, and the cashier may process any order from the live
  panel. Cash payments can be confirmed manually; online payments must be
  confirmed by the payment provider. The Super Admin may additionally mark an
  order as a test; test orders are labeled in the operations queue and excluded
  from dashboard revenue metrics.
- The live panel uses a reduced-click workflow: start preparing, mark ready,
  then complete. Starting preparation automatically records acceptance, and
  completing a cash order records payment in the same action.

## Project layout

See [`zombeans-plan.md`](./zombeans-plan.md) §6.
