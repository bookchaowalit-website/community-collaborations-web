# Collaborations (field folio)

A small notebook for collaboration ideas, kept in this browser: add a note with a title, details and a status
(Draft, Open, Active, Done), search the notes, remove one. Open and Active notes count as "living threads".
Notes are saved in `localStorage` on this device only.

Live: https://collaborations.bookchaowalit.com (deployed by Vercel CLI; it can lag `main`, see `PRODUCT.md`).

## What it does not do

- No accounts, sharing, invitations, skill matching or proposal form. Nobody else sees your notes.
- No backend or sync: clearing site data or using another browser starts again from the two sample notes.
- Status is set when a note is planted; there is no edit.

## Run

```bash
npm ci
npm run dev
```

## Checks

```bash
npm test           # Vitest: note logic and storage, MCP route, home page render, Sentry scrubbing
npm run lint
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) runs the shared Node workflow (with a line-coverage gate) and the shared security
scan on every push and PR to `main`.

## Code map

- `lib/collaborations.ts`: sample notes, parse/serialize of saved notes (bad or wrong-shape data falls back to the
  samples), search, add/remove, living count, and the `localStorage` store the page reads with `useSyncExternalStore`.
- `app/page.tsx`: the folio page.
- `app/api/mcp/route.ts`: stateless JSON-RPC endpoint; `initialize` and an empty `tools/list`, every call refused.
- `lib/sentry.ts` + `instrumentation*.ts`: error reporting to Sentry, errors only, personal data stripped; off when
  `NEXT_PUBLIC_SENTRY_DSN` is unset.
- `app/more-projects/page.tsx`: shared portfolio link page (copied per repository, not a package).
