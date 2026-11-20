import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import RootLayout, { metadata } from "@/app/layout";

vi.mock("next/font/google", () => ({ Geist: () => ({ variable: "font-geist" }) }));

describe("home page", () => {
  it("renders the sample notes, the status lists and the local-only notice on the App shell", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("<h1>All notes</h1>");
    expect(html).toContain("Open source docs");
    expect(html).toContain("Field notes exchange");
    expect(html).toMatch(/All notes<\/span><span class="as-count">2</);
    // The count says both numbers, so "1 living" and "2 notes" no longer look contradictory.
    expect(html).toContain("2 notes · 1 living (Open or Active)");
    expect(html).toContain("No account and no backend");
    expect(html).toContain('href="https://bookchaowalit.com/"');
  });

  it("puts the font variable on <html>, the site's own domain and a full description in metadata", () => {
    const html = renderToString(<RootLayout><p>child</p></RootLayout>);
    expect(html).toContain('<html lang="en" class="font-geist"');
    expect(String(metadata.metadataBase)).toBe("https://collaborations.bookchaowalit.com/");
    expect(String(metadata.description).length).toBeGreaterThan(60);
  });
});
