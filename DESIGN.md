# Design

Since 2026-11-19 the collaborations notebook uses the shared **App shell** (see `APP-SHELL.md`; `app/app-shell.css` and `components/app-shell.tsx` are copied byte for byte
from the reference site). It replaced the earlier one-off look, whose small uppercase labels, unloaded or
render-blocking fonts and low-contrast text failed the design floor (review 2026-11-11).

- Sidebar of statuses (All / Draft / Open / Active / Done with counts; a pill row on phones), head with h1,
  a count that names both numbers ("2 notes · 1 living (Open or Active)"), search and **New note**, the
  composer in place (title, details, status).
- Rows: title, one line of detail, date added, a status pill (text + tint) and Remove. Removing is undoable
  for a few seconds; no confirm dialog.
- Empty states differ for no notes, an empty status and a search with no match (Clear search).

Floor: Geist via `next/font` (variable on `<html>`), text ≥ 12px, controls ≥ 44px, 4.5:1 text contrast in
light and dark, 3px focus ring, forced-colors support, no horizontal scroll at 320px. `/more-projects`
redirects (308) to https://bookchaowalit.com/ and the footer links there.
