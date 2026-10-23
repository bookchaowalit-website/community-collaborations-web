import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("home page", () => {
  it("renders the folio, the form and the local-only notice", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("Grow the right work");
    expect(html).toContain("Plant note");
    expect(html).toContain("Local browser storage only.");
    expect(html).toContain("State stays in this browser. No backend is implied.");
  });

  it("renders the two sample notes on the server, one of them living", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("Open source docs");
    expect(html).toContain("Field notes exchange");
    expect(html).toMatch(/1<!-- --> living <!-- -->thread/);
    expect(html).toMatch(/<b>2<\/b> total notes/);
  });
});
