// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { SEED, STORAGE_KEY, noteStore } from "@/lib/collaborations";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const $ = <T extends Element = HTMLElement>(selector: string) => host.querySelector(selector) as T | null;
const button = (text: string, scope: ParentNode = host) => [...scope.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(text)) as HTMLButtonElement;
const rows = () => [...host.querySelectorAll(".as-row h3")].map((h) => h.textContent);
const press = (el: Element, detail = 0) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail })); });
function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  localStorage.clear();
  noteStore.update(() => SEED);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Home />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("composer", () => {
  it("opens focused, keeps Add disabled without a title, adds on top and returns focus", () => {
    press(button("New note"));
    expect(document.activeElement).toBe($(".as-composer input"));
    expect(button("Add", $(".as-composer")!).disabled).toBe(true);
    type($<HTMLInputElement>(".as-composer input")!, "Podcast swap");
    type($<HTMLTextAreaElement>(".as-composer textarea")!, "Guest on each other's show");
    press(button("Active", $(".as-composer")!));
    press(button("Add", $(".as-composer")!));
    expect(rows()[0]).toBe("Podcast swap");
    expect(document.activeElement?.textContent).toContain("New note");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0]).toMatchObject({ title: "Podcast swap", status: "Active" });
  });

  it("adding from another list switches to the new note's list; Cancel adds nothing", () => {
    press(button("Done", $(".as-side")!));
    expect(host.textContent).toContain("Nothing is Done yet");
    press(button("New note"));
    type($<HTMLInputElement>(".as-composer input")!, "Bare");
    press(button("Add", $(".as-composer")!));
    expect($("h1")!.textContent).toBe("Draft");
    expect(host.textContent).toContain("No detail recorded yet.");
    press(button("New note"));
    type($<HTMLInputElement>(".as-composer input")!, "never");
    press(button("Cancel"));
    expect(rows()).not.toContain("never");
  });

  it("still adds without crypto.randomUUID", () => {
    vi.stubGlobal("crypto", {});
    try {
      press(button("New note"));
      type($<HTMLInputElement>(".as-composer input")!, "Plain HTTP");
      press(button("Add", $(".as-composer")!));
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0].id).toMatch(/^note-\d+-[a-z0-9]+$/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("search and empty states", () => {
  it("search narrows the list and Clear search brings it back with focus in the field", () => {
    type($<HTMLInputElement>(".as-search input")!, "zzz");
    expect(host.textContent).toContain("Nothing matches");
    press(button("Clear search"));
    expect(document.activeElement).toBe($(".as-search input"));
    expect(rows()).toEqual(["Open source docs", "Field notes exchange"]);
  });
});

describe("remove and undo", () => {
  it("removes with a toast; Undo puts it back in place and focuses its row", () => {
    press($('[aria-label="Remove Open source docs"]')!);
    expect(rows()).toEqual(["Field notes exchange"]);
    expect(document.activeElement).toBe(button("Undo"));
    press(button("Undo"));
    expect(rows()).toEqual(["Open source docs", "Field notes exchange"]);
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Remove Open source docs");
  });

  it("Escape and the timer close the toast; an empty folio says how to start", () => {
    press($('[aria-label="Remove Open source docs"]')!);
    act(() => { $(".as-toast")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Remove Field notes exchange");
    vi.useFakeTimers();
    press($('[aria-label="Remove Field notes exchange"]')!, 1);
    act(() => { vi.advanceTimersByTime(6100); });
    expect($(".as-toast")).toBeNull();
    expect(host.textContent).toContain("No notes yet");
  });
});

describe("batch Undo", () => {
  afterEach(() => { vi.useRealTimers(); });
  // Three copies of the samples, so there are enough rows to remove two.
  beforeEach(() => {
    act(() => { noteStore.update(() => ([1, 2, 3].flatMap((n) => SEED.map((item) => ({ ...item, id: `${item.id}-${n}` }))))); });
  });
  // detail 0 = keyboard (Enter/Space) click, 1 = pointer click.
  const click = (el: Element, detail: number) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail })); });
  const shownRows = () => [...host.querySelectorAll<HTMLElement>(".as-row[data-note]")];
  const rowIds = () => shownRows().map((row) => row.getAttribute("data-note"));
  const removeButton = (i: number) => shownRows()[i].querySelector<HTMLButtonElement>(".as-danger")!;
  const undoButton = () => host.querySelector<HTMLButtonElement>(".as-toast button")!;

  it("consecutive removes restore together with one Undo", () => {
    vi.useFakeTimers();
    const before = rowIds();
    expect(before.length).toBeGreaterThanOrEqual(3);
    click(removeButton(1), 1);
    act(() => { vi.advanceTimersByTime(4000); });
    click(removeButton(0), 1);
    expect(rowIds()).toEqual(before.slice(2));
    expect(host.querySelector(".as-toast span")!.textContent).toBe("Removed 2 notes");
    expect(undoButton().getAttribute("aria-label")).toBe("Undo remove of 2 notes");
    // The second removal restarted the 6 s window: 4 s later it is still open.
    act(() => { vi.advanceTimersByTime(4000); });
    click(undoButton(), 1);
    expect(rowIds()).toEqual(before);
    expect(host.querySelector(".as-toast")).toBeNull();
    expect(host.querySelector(".as-sr[role=status]")!.textContent).toBe("Restored 2 notes.");
  });

  it("keyboard remove focuses Undo", () => {
    const before = rowIds();
    click(removeButton(0), 0);
    expect(document.activeElement).toBe(undoButton());
    click(removeButton(0), 0);
    expect(document.activeElement).toBe(undoButton());
    click(undoButton(), 0);
    expect(rowIds()).toEqual(before);
    // Back on the restored row removed last (it was second in the list).
    expect(document.activeElement).toBe(removeButton(1));
  });
});

describe("full note detail", () => {
  afterEach(() => { vi.restoreAllMocks(); });
  function remount() {
    act(() => root.unmount());
    root = createRoot(host);
    act(() => root.render(<Home />));
  }

  it("a note detail clipped to one line gets Show more, which opens the full text", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("as-row-detail") ? 400 : 200;
    });
    remount();
    const more = button("Show more");
    expect(more).toBeDefined();
    press(more);
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(more.getAttribute("aria-controls")!)?.dataset.expanded).toBe("true");
    expect(button("Show less")).toBe(more);
  });

  it("a note detail that fits gets no Show more", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(200);
    remount();
    expect(button("Show more")).toBeUndefined();
  });

  it("a saved timestamp outside the Date range shows the row without a date instead of crashing", () => {
    act(() => { noteStore.update(() => [{ id: "far", title: "Far future", body: "x", status: "Open", createdAt: 1e300 }, ...SEED]); });
    remount();
    expect(rows()).toContain("Far future");
    const row = [...host.querySelectorAll(".as-row")].find((r) => r.querySelector("h3")?.textContent === "Far future")!;
    expect(row.textContent).toContain("Added date unknown");
    expect(row.querySelector("time")).toBeNull();
  });
});

describe("round 2: counts and names", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("while searching, the count says matches out of the notes in the list, and living counts the matches", () => {
    type($<HTMLInputElement>(".as-search input")!, "research");
    expect($(".as-head p")!.textContent).toBe("1 of 2 notes match “research” · 0 living (Open or Active)");
    press(button("Open", $(".as-side")!));
    expect($(".as-head p")!.textContent).toBe("0 of 1 note match “research”");
  });

  it("Show more names the note it opens", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("as-row-detail") ? 400 : 200;
    });
    act(() => root.unmount());
    root = createRoot(host);
    act(() => root.render(<Home />));
    const more = button("Show more");
    expect(more.textContent).toBe("Show more for Open source docs");
    expect(more.querySelector(".as-sr")!.textContent).toBe(" for Open source docs");
    press(more);
    expect(more.textContent).toBe("Show less for Open source docs");
  });
});
