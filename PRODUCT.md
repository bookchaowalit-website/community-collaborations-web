# Collaborations (field folio) — Product truth

> Inferred from the code and copy (no user interview). Checked against the portfolio card claims review
> (`portfolio-site-web/docs/audits/CARD-CLAIMS-REVIEW-2026-10.md`, row `collaborations`) on 2026-10-23.

## What it is

A client-only page for jotting down collaboration ideas. Notes live in the visitor's browser (`localStorage`, key
`collabs-v1`). There is no backend, account or shared space.

## Who it is for

A portfolio visitor (or the owner) who wants a quick private list of "work that wants another set of hands".

## What works today

1. Plant a note with a title (required), details and a status: Draft, Open, Active or Done.
2. The header counts Open and Active notes as living threads, plus total notes and notes in view.
3. Search across title, details and status (case-insensitive); remove a note.
4. Notes survive a reload in the same browser. Corrupt or wrong-shape saved data falls back to the two sample notes
   instead of breaking the page; if storage is blocked, notes last for the visit only.
5. `/api/mcp` answers JSON-RPC `initialize` and `tools/list` with an empty tool list: notes never reach the server,
   so any `tools/call` is refused with an error.
6. Front-end and server errors go to Sentry (errors only, personal data stripped) when `NEXT_PUBLIC_SENTRY_DSN` is set.

## What does not work (and must not be claimed)

- No skill matching, no proposal submission form, no collaborator accounts or invitations (the portfolio card was
  corrected to Prototype in the 2026-10 review).
- No editing a note after it is planted, no sync between devices, no export.

## Live URL and deploy state

- Live: https://collaborations.bookchaowalit.com (HTTP 200 on 2026-10-23).
- The Vercel project `bookchaowalit-collaborations-frontend` is deployed only by CLI. Its last production deploy is
  the CVE patch (2026-10-23, CLI, commit 6c6e712). Its Git link names the old repository
  `bookchaowalit/bookchaowalit-collaborations-frontend`, so a push to `main` does not deploy: the L2 work (tests,
  Sentry, lib store, truthful MCP route) stays undeployed until the owner reconnects Vercel Git to this repository
  (owner action D9). `NEXT_PUBLIC_SENTRY_DSN` is already set on the Vercel project (Sentry project
  `community-collaborations-web`, org `personal-yu0`).

## Boundaries

- Browser-only apart from the stateless `/api/mcp` route.
