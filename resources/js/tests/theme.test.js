// @vitest-environment jsdom

import { describe, expect, it } from "vite-plus/test";
import { applySiteTheme } from "../../game/theme";

describe("site theme", function describeSiteTheme() {
  it("applies the dark theme", function testDarkTheme() {
    applySiteTheme("dark");

    expect(document.documentElement.classList.contains("dark-mode")).toBe(true);
  });

  it("removes the dark theme for the light theme", function testLightTheme() {
    document.documentElement.classList.add("dark-mode");

    applySiteTheme("light");

    expect(document.documentElement.classList.contains("dark-mode")).toBe(false);
  });
});
