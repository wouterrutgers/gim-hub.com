// @vitest-environment jsdom

import { describe, expect, it } from "vite-plus/test";
import { applySiteTheme } from "../../game/theme";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { cachePlayerPreferences } from "../../stores/cached-player-preferences";

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

  it("applies the remembered classic theme before the application loads and keeps demo startup separate", function cachedTheme() {
    localStorage.setItem("groupName", "test-group");
    localStorage.setItem("selected-players", JSON.stringify({ "test-group": 1 }));
    cachePlayerPreferences("test-group", 1, "Alice", { siteTheme: "classic-dark" });
    const template = readFileSync("resources/views/index.blade.php", "utf8");
    const script = template.match(/<script>([\s\S]*?)<\/script>/)[1];

    runInNewContext(script, { document, localStorage, window: { location: { pathname: "/group/items" } } });

    expect(document.documentElement.classList.contains("dark-mode")).toBe(true);
    expect(document.documentElement.classList.contains("classic-mode")).toBe(true);
    document.documentElement.className = "";

    runInNewContext(script, { document, localStorage, window: { location: { pathname: "/demo" } } });

    expect(document.documentElement.classList.contains("dark-mode")).toBe(false);
    expect(document.documentElement.classList.contains("classic-mode")).toBe(false);
  });
});
