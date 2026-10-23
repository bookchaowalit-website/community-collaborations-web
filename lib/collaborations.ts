// Collaboration notes: the page's data, list rules and its localStorage store.
// Everything here is pure or works through a storage object passed in, so it can be tested without a browser.

export type Note = { id: string; title: string; body: string; status: string; createdAt: number };
export type Draft = { title: string; body: string; status: string };

export const STORAGE_KEY = "collabs-v1";
export const STATUSES = ["Draft", "Open", "Active", "Done"] as const;
export const EMPTY_DRAFT: Draft = { title: "", body: "", status: "Draft" };

/** Two sample notes shown until the visitor saves their own. Fixed timestamps keep server and client renders equal. */
export const SEED: Note[] = [
  { id: "1", title: "Open source docs", body: "Write guides together", status: "Open", createdAt: Date.UTC(2026, 0, 2) },
  { id: "2", title: "Field notes exchange", body: "Share a research pass", status: "Draft", createdAt: Date.UTC(2025, 11, 31) },
];

function isNote(value: unknown): value is Note {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.title === "string" &&
    typeof entry.body === "string" &&
    typeof entry.status === "string" &&
    typeof entry.createdAt === "number"
  );
}

/** Saved notes, or null when nothing usable is saved. Entries of the wrong shape are dropped. */
export function parseNotes(raw: string | null): Note[] | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isNote) : null;
  } catch {
    return null;
  }
}

export function serializeNotes(notes: Note[]): string {
  return JSON.stringify(notes);
}

export function filterNotes(notes: Note[], query: string): Note[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return notes;
  return notes.filter((note) => `${note.title} ${note.body} ${note.status}`.toLowerCase().includes(needle));
}

/** Open and Active notes are the "living threads". */
export function countLiving(notes: Note[]): number {
  return notes.filter((note) => note.status === "Open" || note.status === "Active").length;
}

/** New note on top; a blank title changes nothing (same array back). */
export function addNote(notes: Note[], draft: Draft, id: string, now: number): Note[] {
  const title = draft.title.trim();
  if (!title) return notes;
  return [{ id, title, body: draft.body.trim(), status: draft.status, createdAt: now }, ...notes];
}

export function removeNote(notes: Note[], id: string): Note[] {
  return notes.filter((note) => note.id !== id);
}

type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void };

/**
 * A store for useSyncExternalStore. The server snapshot is the seed, so the first client render matches the
 * server HTML; saved notes appear right after hydration. If storage is blocked, notes live in memory for the visit.
 */
export function createNoteStore(getStorage: () => StorageLike | undefined, key = STORAGE_KEY) {
  let current: Note[] = SEED;
  let lastRaw: string | null = null;
  const listeners = new Set<() => void>();

  function getSnapshot(): Note[] {
    let raw: string | null;
    try {
      raw = getStorage()?.getItem(key) ?? null;
    } catch {
      return current;
    }
    if (raw === null || raw === lastRaw) return current;
    lastRaw = raw;
    current = parseNotes(raw) ?? SEED;
    return current;
  }

  function update(change: (notes: Note[]) => Note[]) {
    current = change(getSnapshot());
    try {
      const raw = serializeNotes(current);
      getStorage()?.setItem(key, raw);
      lastRaw = raw;
    } catch {
      // Storage is full or blocked: keep the notes in memory.
    }
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    if (typeof window !== "undefined") window.addEventListener("storage", listener);
    return () => {
      listeners.delete(listener);
      if (typeof window !== "undefined") window.removeEventListener("storage", listener);
    };
  }

  return { getSnapshot, getServerSnapshot: () => SEED, subscribe, update };
}

export const noteStore = createNoteStore(() => (typeof window === "undefined" ? undefined : window.localStorage));
