import { describe, expect, it } from "vitest";
import { safeCallback } from "./callback";

describe("safeCallback", () => {
  it("keeps a relative path", () => {
    expect(safeCallback("/c/cca-f/practice")).toBe("/c/cca-f/practice");
  });

  it("reduces a same-origin absolute URL to its path", () => {
    // This is the shape the proxy actually produces.
    expect(safeCallback("http://localhost:3001/dashboard")).toBe("/dashboard");
  });

  it("preserves the query string", () => {
    expect(safeCallback("https://example.com/c/cca-f/practice?n=20")).toBe(
      "/c/cca-f/practice?n=20",
    );
  });

  it("strips the origin from a cross-origin URL rather than following it", () => {
    // The path survives, the host does not — so it can never leave the origin.
    expect(safeCallback("https://evil.example/steal")).toBe("/steal");
  });

  it("rejects a protocol-relative URL", () => {
    expect(safeCallback("//evil.example/steal")).toBe("/dashboard");
  });

  it("rejects a javascript: URL", () => {
    expect(safeCallback("javascript:alert(1)")).toBe("/dashboard");
  });

  it("rejects a data: URL", () => {
    expect(safeCallback("data:text/html,<script>alert(1)</script>")).toBe("/dashboard");
  });

  it("falls back when absent or unparseable", () => {
    expect(safeCallback(undefined)).toBe("/dashboard");
    expect(safeCallback("not a url")).toBe("/dashboard");
  });
});
