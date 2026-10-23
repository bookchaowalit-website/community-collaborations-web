import { describe, expect, it, vi } from "vitest";
import {
  SEED,
  STORAGE_KEY,
  addNote,
  countLiving,
  createNoteStore,
  filterNotes,
  parseNotes,
  removeNote,
  serializeNotes,
  type Note,
} from "@/lib/collaborations";

const note = (overrides: Partial<Note> = {}): Note => ({
  id: "x",
  title: "Pair on docs",
  body: "Write the setup guide",
  status: "Open",
  createdAt: 1,
  ...overrides,
});

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("parseNotes", () => {
  it("returns null for missing, malformed or non-array JSON", () => {
    expect(parseNotes(null)).toBeNull();
    expect(parseNotes("")).toBeNull();
    expect(parseNotes("{not json")).toBeNull();
    expect(parseNotes('{"id":"1"}')).toBeNull();
    expect(parseNotes("42")).toBeNull();
  });

  it("keeps well-formed notes and drops entries of the wrong shape", () => {
    const raw = JSON.stringify([note({ id: "a" }), { id: "b", title: 3 }, null, "text", note({ id: "c", status: "Done" })]);
    expect(parseNotes(raw)?.map((entry) => entry.id)).toEqual(["a", "c"]);
  });

  it("round-trips through serializeNotes, including an empty list", () => {
    const notes = [note({ id: "a" }), note({ id: "b", body: "" })];
    expect(parseNotes(serializeNotes(notes))).toEqual(notes);
    expect(parseNotes(serializeNotes([]))).toEqual([]);
  });
});

describe("note list logic", () => {
  const notes = [note({ id: "a", title: "Docs sprint", status: "Open" }), note({ id: "b", title: "Field notes", body: "Research pass", status: "Draft" })];

  it("searches title, body and status without case", () => {
    expect(filterNotes(notes, "DOCS").map((entry) => entry.id)).toEqual(["a"]);
    expect(filterNotes(notes, "research").map((entry) => entry.id)).toEqual(["b"]);
    expect(filterNotes(notes, "draft").map((entry) => entry.id)).toEqual(["b"]);
    expect(filterNotes(notes, "  ")).toEqual(notes);
    expect(filterNotes(notes, "nothing here")).toEqual([]);
  });

  it("counts Open and Active notes as living threads", () => {
    expect(countLiving([note({ status: "Open" }), note({ status: "Active" }), note({ status: "Draft" }), note({ status: "Done" })])).toBe(2);
    expect(countLiving([])).toBe(0);
  });

  it("adds a trimmed note to the top and ignores a blank title", () => {
    const next = addNote(notes, { title: "  New thread ", body: " context ", status: "Active" }, "n1", 99);
    expect(next[0]).toEqual({ id: "n1", title: "New thread", body: "context", status: "Active", createdAt: 99 });
    expect(next).toHaveLength(3);
    expect(addNote(notes, { title: "   ", body: "x", status: "Open" }, "n2", 1)).toBe(notes);
  });

  it("removes a note by id", () => {
    expect(removeNote(notes, "a").map((entry) => entry.id)).toEqual(["b"]);
    expect(removeNote(notes, "missing")).toEqual(notes);
  });
});

describe("createNoteStore", () => {
  it("serves the seed on the server and when nothing is saved", () => {
    const store = createNoteStore(() => fakeStorage());
    expect(store.getServerSnapshot()).toBe(SEED);
    expect(store.getSnapshot()).toBe(SEED);
  });

  it("falls back to the seed when saved data is corrupt instead of crashing the page", () => {
    const store = createNoteStore(() => fakeStorage({ [STORAGE_KEY]: '{"not":"a list"}' }));
    expect(store.getSnapshot()).toBe(SEED);
  });

  it("returns the same array while storage is unchanged, as useSyncExternalStore requires", () => {
    const storage = fakeStorage({ [STORAGE_KEY]: serializeNotes([note()]) });
    const store = createNoteStore(() => storage);
    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first);
    expect(first).toEqual([note()]);
  });

  it("writes updates to storage and notifies subscribers", () => {
    const storage = fakeStorage();
    const store = createNoteStore(() => storage);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.update((current) => removeNote(current, SEED[0].id));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(parseNotes(storage.data.get(STORAGE_KEY) ?? null)).toEqual(SEED.slice(1));
    expect(store.getSnapshot()).toEqual(SEED.slice(1));
    unsubscribe();
    store.update((current) => current);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps working in memory when storage throws (private mode, blocked site data)", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const store = createNoteStore(() => broken);
    expect(store.getSnapshot()).toBe(SEED);
    store.update(() => [note({ id: "mem" })]);
    expect(store.getSnapshot().map((entry) => entry.id)).toEqual(["mem"]);
  });
});
