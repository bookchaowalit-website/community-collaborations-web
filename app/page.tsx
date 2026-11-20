"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { AppFoot, AppTop, ListButton, Pill, PlusIcon, type Tone } from "@/components/app-shell";
import { EMPTY_DRAFT, STATUSES, addNote, countLiving, addedIso, formatAdded, noteStore, notesIn, restoreNote, type Draft, type Filter, type Note, type Status } from "@/lib/collaborations";

// beforeId: the note that followed it when it was removed. nextShown / prevShown: the rows shown around it, for focus.
type RemovedEntry = { note: Note; beforeId: string | null; nextShown?: string; prevShown?: string };
type RemovedBatch = { entries: RemovedEntry[]; viaKeyboard: boolean };
const removedLabel = (entries: RemovedEntry[]) => (entries.length === 1 ? `Removed “${entries[0].note.title}”` : `Removed ${entries.length} notes`);

const TONE: Record<Status, Tone> = { Draft: "grey", Open: "amber", Active: "green", Done: "grey" };
const FILTERS: Filter[] = ["All", ...STATUSES];

// randomUUID only exists in secure contexts (HTTPS/localhost) and newer browsers.
function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// One line of the note's details per row (App shell rule); a longer one gets Show more, so the full text can still be read.
function RowDetail({ text, title }: { text: string; title: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => { if (el.dataset.expanded !== "true") setClipped(el.scrollWidth > el.clientWidth); };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    measure();
    // A web font that loads later can widen the text without resizing the box, so measure again then.
    let live = true;
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    const remeasure = () => { if (live) measure(); };
    fonts?.ready?.then(remeasure, () => {});
    fonts?.addEventListener?.("loadingdone", remeasure);
    return () => {
      live = false;
      observer?.disconnect();
      fonts?.removeEventListener?.("loadingdone", remeasure);
    };
  }, [text]);
  const long = expanded || clipped || text.includes("\n");
  return (
    <>
      <p ref={ref} id={id} className="as-row-detail" data-expanded={expanded ? "true" : undefined}>{text}</p>
      {long ? (
        <button type="button" className="as-plain as-row-more" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show less" : "Show more"}<span className="as-sr"> for {title}</span>
        </button>
      ) : null}
    </>
  );
}

export default function Home() {
  const notes = useSyncExternalStore(noteStore.subscribe, noteStore.getSnapshot, noteStore.getServerSnapshot);
  const setNotes = noteStore.update;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  // Every removal still inside the Undo window: one Undo puts them all back where they were.
  const [removed, setRemovedState] = useState<RemovedBatch | null>(null);
  // The latest batch, so two removals before a re-render still both land in it.
  const removedRef = useRef<RemovedBatch | null>(null);
  const setRemoved = (batch: RemovedBatch | null) => { removedRef.current = batch; setRemovedState(batch); };
  const [toastFocused, setToastFocused] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const wasComposing = useRef(false);
  const focusNext = useRef<string[] | null>(null);
  const visible = useMemo(() => notesIn(notes, filter, query), [notes, filter, query]);
  const living = countLiving(notes);
  const countOf = (value: Filter) => (value === "All" ? notes.length : notes.filter((item) => item.status === value).length);

  // Opening the composer focuses the title; closing it returns focus to New note.
  useEffect(() => {
    if (composing) titleRef.current?.focus();
    else if (wasComposing.current) newRef.current?.focus();
    wasComposing.current = composing;
  }, [composing]);
  useEffect(() => { if (removed?.viaKeyboard) undoRef.current?.focus(); }, [removed]);
  // After the toast closes, focus goes to the nearest row still shown, else New note.
  useEffect(() => {
    const ids = focusNext.current;
    if (removed || !ids) return;
    focusNext.current = null;
    const rows = [...document.querySelectorAll<HTMLElement>(".as-row[data-note]")];
    const row = ids.map((id) => rows.find((r) => r.dataset.note === id)).find(Boolean);
    (row?.querySelector<HTMLButtonElement>(".as-danger") ?? newRef.current ?? titleRef.current)?.focus();
  }, [removed, notes]);
  // Reserve the toast's height at the bottom so a control focused behind it scrolls clear.
  const toastShown = removed !== null;
  useLayoutEffect(() => {
    const toast = toastRef.current;
    if (!toastShown || !toast) return;
    const rootStyle = document.documentElement.style;
    const reserve = () => rootStyle.setProperty("--as-toast-space", `${toast.offsetHeight + 32}px`);
    reserve();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(reserve) : null;
    observer?.observe(toast);
    return () => { observer?.disconnect(); rootStyle.removeProperty("--as-toast-space"); };
  }, [toastShown]);
  // The toast closes 6 s after the latest removal (each removal restarts it), but never while it holds focus.
  useEffect(() => {
    if (!removed || toastFocused) return;
    const timer = window.setTimeout(() => { removedRef.current = null; setRemovedState(null); }, 6000);
    return () => window.clearTimeout(timer);
  }, [removed, toastFocused]);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = addNote(notes, draft, createId(), Date.now());
    if (next === notes) return;
    const note = next[0];
    setNotes((items) => [note, ...items]);
    const status = note.status as Status;
    if (filter !== "All" && filter !== status) setFilter(status);
    setQuery("");
    setAnnouncement(`Added “${note.title}”.`);
    setDraft(EMPTY_DRAFT);
    setComposing(false);
  }
  function clearSearch() {
    setQuery("");
    searchRef.current?.focus();
  }
  function remove(note: Note, viaKeyboard: boolean) {
    const index = notes.findIndex((item) => item.id === note.id);
    if (index < 0) return;
    const shownAt = visible.findIndex((item) => item.id === note.id);
    setNotes((items) => items.filter((item) => item.id !== note.id));
    const entry: RemovedEntry = { note, beforeId: notes[index + 1]?.id ?? null, nextShown: visible[shownAt + 1]?.id, prevShown: shownAt > 0 ? visible[shownAt - 1].id : undefined };
    const entries = [...(removedRef.current?.entries ?? []), entry];
    setRemoved({ entries, viaKeyboard });
    setAnnouncement(entries.length === 1 ? `Removed “${note.title}”. Undo is available for a few seconds.` : `Removed ${entries.length} notes. Undo is available for a few seconds.`);
  }
  function closeToast(ids?: string[]) {
    const last = removedRef.current?.entries.at(-1);
    // Dismissed: the row after the removed one, else the one before it.
    focusNext.current = ids ?? [last?.nextShown, last?.prevShown].filter((id): id is string => Boolean(id));
    setRemoved(null);
    setToastFocused(false);
  }
  function undo() {
    const entries = removedRef.current?.entries;
    if (!entries?.length) return;
    // Latest removal first: each goes back before the note that followed it when it was removed.
    setNotes((current) => entries.reduceRight((list, { note, beforeId }) => restoreNote(list, note, beforeId), current));
    const latest = entries[entries.length - 1].note;
    setAnnouncement(entries.length === 1 ? `Restored “${latest.title}”.` : `Restored ${entries.length} notes.`);
    // Undone: back to the restored row the user removed last.
    closeToast([latest.id]);
  }

  const title = filter === "All" ? "All notes" : filter;
  // While searching, say what the number counts: matches out of the notes in this list. "Living" counts the
  // same notes as the number before it (the matches while searching), never the whole folio.
  const searching = query.trim();
  const inList = countOf(filter);
  const countLine = searching
    ? `${visible.length} of ${inList} ${inList === 1 ? "note" : "notes"} match “${searching}”${filter === "All" ? ` · ${countLiving(visible)} living (Open or Active)` : ""}`
    : `${visible.length} ${visible.length === 1 ? "note" : "notes"}${filter === "All" ? ` · ${living} living (Open or Active)` : ""}`;

  return (
    <div className="as">
      <a className="as-skip" href="#main">Skip to content</a>
      <AppTop name="Collaborations" tagline="Ideas that want another set of hands" />

      <div className="as-body">
        <aside className="as-side" aria-label="Lists">
          <h2>By status</h2>
          <ul className="as-lists">
            {FILTERS.map((value) => (
              <ListButton key={value} label={value === "All" ? "All notes" : value} count={countOf(value)} tone={value === "All" ? undefined : TONE[value]} current={filter === value} onSelect={() => setFilter(value)} />
            ))}
          </ul>
        </aside>

        <main id="main" className="as-main">
          <div className="as-head">
            <div>
              <h1>{title}</h1>
              <p aria-live="polite">{countLine}</p>
            </div>
            <div className="as-tools">
              <label className="as-search">
                <span className="as-sr">Search notes</span>
                <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
              </label>
              {composing ? null : <button ref={newRef} type="button" className="as-button" onClick={() => setComposing(true)}><PlusIcon />New note</button>}
            </div>
          </div>

          {composing ? (
            <form className="as-composer" onSubmit={add} aria-label="New note">
              <label className="as-field">Title
                <input ref={titleRef} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="What wants to happen?" autoComplete="off" required />
              </label>
              <label className="as-field">Details
                <textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="The useful context for a collaborator" rows={3} />
              </label>
              <div className="as-composer-foot">
                <div className="as-segmented-wrap">
                  <span id="state-label">Status</span>
                  <div className="as-segmented" role="group" aria-labelledby="state-label">
                    {STATUSES.map((status) => (
                      <button key={status} type="button" aria-pressed={draft.status === status} onClick={() => setDraft({ ...draft, status })}>{status}</button>
                    ))}
                  </div>
                </div>
                <div className="as-composer-actions">
                  <button type="button" className="as-plain" onClick={() => { setComposing(false); setDraft(EMPTY_DRAFT); }}>Cancel</button>
                  <button type="submit" className="as-button" disabled={!draft.title.trim()}>Add</button>
                </div>
              </div>
            </form>
          ) : null}

          {visible.length ? (
            <ul className="as-list" aria-label={title}>
              {visible.map((note) => (
                <li className="as-row" key={note.id} data-note={note.id}>
                  <div>
                    <h3>{note.title}</h3>
                    <RowDetail title={note.title} text={note.body || "No detail recorded yet."} />
                    <p className="as-row-meta">{addedIso(note.createdAt) ? <>Added <time dateTime={addedIso(note.createdAt)!}>{formatAdded(note.createdAt)}</time></> : "Added date unknown"}</p>
                  </div>
                  <Pill tone={TONE[note.status as Status] ?? "grey"}>{note.status}</Pill>
                  <button type="button" className="as-plain as-danger" aria-label={`Remove ${note.title}`} onClick={(event) => remove(note, event.detail === 0)}>Remove</button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="as-list as-empty">
              {query.trim() ? (
                <>
                  <strong>Nothing matches</strong>
                  No note in {filter === "All" ? "your folio" : title} mentions “{query.trim()}”.
                  <div className="as-actions-row co-center"><button type="button" className="as-plain" onClick={clearSearch}>Clear search</button></div>
                </>
              ) : notes.length === 0 ? (
                <><strong>No notes yet</strong>Press New note to write down the first idea that wants a collaborator.</>
              ) : (
                <><strong>Nothing is {title} yet</strong>Press New note and pick {title} as its status to add one here.</>
              )}
            </div>
          )}

          <p className="as-note">Saved in this browser only. No account and no backend: nothing is shared with anyone.</p>
        </main>
      </div>

      <p className="as-sr" role="status" aria-live="polite">{announcement}</p>
      {removed ? (
        <div
          ref={toastRef}
          className="as-toast"
          role="group"
          aria-label="Undo remove"
          onFocus={() => setToastFocused(true)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setToastFocused(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") closeToast(); }}
        >
          <span>{removedLabel(removed.entries)}</span>
          <button ref={undoRef} type="button" className="as-plain" onClick={undo} aria-label={removed.entries.length === 1 ? "Undo remove" : `Undo remove of ${removed.entries.length} notes`}>Undo</button>
        </div>
      ) : null}

      <AppFoot source="https://github.com/bookchaowalit-website/community-collaborations-web" />
    </div>
  );
}
