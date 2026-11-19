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
