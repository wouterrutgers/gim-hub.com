// @vitest-environment jsdom

import { h, nextTick, reactive } from "vue";
import { setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { expect, it, vi } from "vite-plus/test";
import { createTestApplication, createTestPinia } from "./vue-test-helpers";
import { useApiStore } from "../../stores/api";
import { useGroupStore } from "../../stores/group";
import { useSettingsStore } from "../../stores/settings";
import { usePlayerPreferencesStore } from "../../stores/player-preferences";

vi.mock("../../stores/group", function mockGroupStore() {
  return { useGroupStore: vi.fn() };
});

it("syncs player preferences across visits and devices", async function syncPreferences() {
  const server = createServer();
  let session = await mountPreferences(server);
  expect(session.preferences.chooserOpen).toBe(true);

  await session.preferences.choosePlayer(1);
  session.settings.setEnableGearscapeExport(true);
  await vi.waitFor(function saved() {
    expect(server.profiles.get(1).enableGearscapeExport).toBe(true);
  });
  expect(server.patches.at(-1)).toEqual({ memberId: 1, changes: { enableGearscapeExport: true } });
  session.settings.setSiteTheme("dark");
  session.settings.setShowActivitySidebar(true);
  session.settings.setPinnedItemIds([1511]);
  session.settings.setDismissedPluginWarningVersions('["1.9.2"]');
  await vi.waitFor(function otherPreferencesSaved() {
    expect(server.profiles.get(1).dismissedPluginWarningVersions).toBe('["1.9.2"]');
  });
  session.application.unmount();

  session = await mountPreferences(server);
  await vi.waitFor(function restored() {
    expect(session.preferences.selectedMemberId).toBe(1);
  });
  expect(session.settings.siteTheme).toBe("dark");
  session.application.unmount();
  localStorage.clear();

  session = await mountPreferences(server);
  await session.preferences.choosePlayer(1);
  expect(session.settings.siteTheme).toBe("dark");
  expect(session.settings.enableGearscapeExport).toBe(true);
  expect(session.settings.showActivitySidebar).toBe(true);
  expect(session.settings.pinnedItemIds).toEqual([1511]);
  expect(session.settings.dismissedPluginWarningVersions).toBe('["1.9.2"]');
});

it("preserves the current player on a failed switch and uses defaults for a new player", async function switchPreferences() {
  const server = createServer();
  const session = await mountPreferences(server);
  await session.preferences.choosePlayer(1);
  session.settings.setSiteTheme("classic-dark");
  await vi.waitFor(function saved() {
    expect(server.profiles.get(1).siteTheme).toBe("classic-dark");
  });
  server.failMember = 2;
  vi.spyOn(console, "error").mockImplementation(function ignoreExpectedError() {});

  expect(await session.preferences.choosePlayer(2)).toBe(false);
  expect(session.preferences.selectedMemberId).toBe(1);
  expect(session.settings.siteTheme).toBe("classic-dark");
  server.failMember = undefined;
  let finishRead;
  server.holdRead = new Promise(function hold(resolve) {
    finishRead = resolve;
  });
  const cancelledSwitch = session.preferences.choosePlayer(2);
  await vi.waitFor(function loadingTarget() {
    expect(server.readHeld).toBe(true);
  });
  session.preferences.closeChooser();
  finishRead(Response.json({ preferences: null }));
  expect(await cancelledSwitch).toBe(false);
  expect(session.preferences.selectedMemberId).toBe(1);
  expect(server.profiles.has(2)).toBe(false);
  server.holdRead = undefined;
  await session.preferences.choosePlayer(2);
  expect(session.settings.siteTheme).toBe("light");
  expect(server.profiles.get(1).siteTheme).toBe("classic-dark");
  expect(server.profiles.get(2).siteTheme).toBe("light");
  expect(session.preferences.selectedMemberId).toBe(2);
  session.group.memberStates.delete("Alice");
  session.group.memberStates.delete("Bob");
  await nextTick();
  expect(session.preferences.selectedMemberId).toBeUndefined();
  session.preferences.openChooser();
  expect(session.preferences.chooserOpen).toBe(false);
  session.group.memberStates.set("Charlie", { id: 4 });
  await vi.waitFor(function newPlayerRequiresSelection() {
    expect(session.preferences.chooserOpen).toBe(true);
  });
});

it("renders cached preferences while loading and accepts server changes without uploading the cache", async function cachedStartup() {
  const server = createServer();
  let session = await mountPreferences(server);
  await session.preferences.choosePlayer(1);
  session.settings.setSiteTheme("dark");
  session.settings.setCollapseNavigation(true);
  await vi.waitFor(function saved() {
    expect(server.profiles.get(1).collapseNavigation).toBe(true);
  });
  session.application.unmount();
  setActivePinia(createTestPinia());
  expect(useSettingsStore().siteTheme).toBe("dark");
  expect(useSettingsStore().collapseNavigation).toBe(true);

  server.profiles.get(1).siteTheme = "browntown";
  const patchCount = server.patches.length;
  let finishRead;
  server.holdRead = new Promise(function hold(resolve) {
    finishRead = resolve;
  });
  session = await mountPreferences(server);
  expect(session.settings.siteTheme).toBe("dark");
  expect(session.preferences.selectedMemberId).toBeUndefined();
  expect(server.patches).toHaveLength(patchCount);

  server.holdRead = undefined;
  finishRead(Response.json({ preferences: server.profiles.get(1) }));
  await vi.waitFor(function reconciled() {
    expect(session.preferences.selectedMemberId).toBe(1);
    expect(session.settings.siteTheme).toBe("browntown");
  });
  expect(server.patches).toHaveLength(patchCount);
  session.application.unmount();
  setActivePinia(createTestPinia());
  expect(useSettingsStore().siteTheme).toBe("browntown");
});

it("isolates cached settings between groups and clears them when the remembered player disappears", async function isolatedCache() {
  const server = createServer();
  const session = await mountPreferences(server);
  await session.preferences.choosePlayer(1);
  session.settings.setSiteTheme("classic-dark");
  await vi.waitFor(function saved() {
    expect(server.profiles.get(1).siteTheme).toBe("classic-dark");
  });

  session.group.loaded = false;
  useApiStore().client = { baseURL: "/api", credentials: { name: "other-group", token: "other-token" } };
  await nextTick();
  expect(session.settings.siteTheme).toBe("light");
  useApiStore().client = { baseURL: "/api", credentials: { name: "test-group", token: "group-token" } };
  await nextTick();
  expect(session.settings.siteTheme).toBe("classic-dark");
  expect(session.preferences.selectedMemberId).toBeUndefined();

  session.group.memberStates.delete("Alice");
  session.group.loaded = true;
  await nextTick();
  expect(session.settings.siteTheme).toBe("light");
  expect(session.preferences.chooserOpen).toBe(true);
  session.application.unmount();
  setActivePinia(createTestPinia());
  expect(useSettingsStore().siteTheme).toBe("light");
});

it("shows new changelog IDs once, including another entry on the same date", async function changelogAcknowledgement() {
  const server = createServer();
  const session = await mountPreferences(server);
  await session.preferences.choosePlayer(1);
  session.preferences.closeChooser();
  expect(session.preferences.changelogOpen).toBe(false);
  server.entries.unshift({ ...server.entries[0], id: "2026-11-06-second", title: "Another update" });

  window.dispatchEvent(new Event("focus"));
  await vi.waitFor(function hasNewEntry() {
    expect(
      session.preferences.unseenEntries.map(function getId(entry) {
        return entry.id;
      }),
    ).toEqual(["2026-11-06-second"]);
  });
  expect(session.preferences.changelogOpen).toBe(true);
  await session.preferences.dismissChangelog();
  expect(session.preferences.changelogOpen).toBe(false);
  session.application.unmount();
  localStorage.clear();

  const otherDevice = await mountPreferences(server);
  await otherDevice.preferences.choosePlayer(1);
  expect(otherDevice.preferences.unseenEntries).toEqual([]);
  server.entries.unshift({ ...server.entries[0], id: "2026-11-06-third" });
  await otherDevice.router.push("/changelog");
  await otherDevice.preferences.markChangelogRead(server.entries);
  expect(otherDevice.preferences.changelogOpen).toBe(false);
  expect(server.profiles.get(1).seenChangelogIds).toContain("2026-11-06-third");
});

it("keeps a failed edit visible when an older refresh finishes and retries the unsaved change", async function staleRefresh() {
  const server = createServer();
  const session = await mountPreferences(server);
  await session.preferences.choosePlayer(1);
  const oldPreferences = structuredClone(server.profiles.get(1));
  let finishRefresh;
  server.holdRead = new Promise(function hold(resolve) {
    finishRefresh = resolve;
  });
  window.dispatchEvent(new Event("focus"));
  await vi.waitFor(function refreshStarted() {
    expect(server.readHeld).toBe(true);
  });
  server.failSaves = true;
  vi.spyOn(console, "error").mockImplementation(function ignoreExpectedError() {});
  session.settings.setSiteTheme("dark");
  await vi.waitFor(function saveFailed() {
    expect(session.preferences.saveError).toBeDefined();
  });

  finishRefresh(Response.json({ preferences: oldPreferences }));
  await nextTick();
  await nextTick();
  expect(session.preferences.saveError).toBeDefined();
  expect(session.settings.siteTheme).toBe("dark");
  server.failSaves = false;
  server.holdRead = undefined;
  await session.preferences.retrySave();
  expect(server.profiles.get(1).siteTheme).toBe("dark");
  expect(session.preferences.saveError).toBeUndefined();
});

async function mountPreferences(server) {
  document.head.innerHTML = '<meta name="csrf-token" content="test-token">';
  localStorage.setItem("groupName", "test-group");
  const pinia = createTestPinia();
  setActivePinia(pinia);
  vi.mocked(useGroupStore).mockReturnValue(
    reactive({
      loaded: true,
      memberStates: new Map([
        ["Alice", { id: 1 }],
        ["Bob", { id: 2 }],
        ["@SHARED", { id: 3 }],
      ]),
    }),
  );
  const apiStore = useApiStore();
  apiStore.client = { baseURL: "/api", credentials: { name: "test-group", token: "group-token" } };
  vi.stubGlobal("fetch", vi.fn(server.fetch));
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: {} }],
  });
  await router.push("/group/items");
  let preferences;
  const application = createTestApplication({
    setup() {
      preferences = usePlayerPreferencesStore();
      preferences.start();

      return function render() {
        return h("div");
      };
    },
  });
  application.use(pinia);
  application.use(router);
  const container = document.createElement("div");
  document.body.append(container);
  application.mount(container);
  await nextTick();

  return { application, preferences, settings: useSettingsStore(), router, group: useGroupStore() };
}

function createServer() {
  const server = {
    profiles: new Map(),
    patches: [],
    entries: [{ id: "2026-11-06-first", date: "2026-11-06", title: "Update", html: "<p>Details</p>" }],
    async fetch(url, options) {
      if (url === "/api/changelog") {
        return Response.json(server.entries);
      }

      const memberId = Number(url.match(/members\/(\d+)\/preferences$/)[1]);

      if (memberId === server.failMember) {
        return new Response(null, { status: 503 });
      }

      if (options.method === "PATCH") {
        if (server.failSaves) {
          return new Response(null, { status: 503 });
        }

        const { initialize, seenChangelogIds, ...settings } = JSON.parse(options.body);
        const current = server.profiles.get(memberId);
        const profile = initialize ? { ...settings, ...current } : { ...current, ...settings };

        if (seenChangelogIds) {
          profile.seenChangelogIds = [...new Set([...(current?.seenChangelogIds ?? []), ...seenChangelogIds])];
        }

        server.profiles.set(memberId, profile);
        server.patches.push({ memberId, changes: JSON.parse(options.body) });
      }

      if (options.method === "GET" && server.holdRead) {
        server.readHeld = true;

        return server.holdRead;
      }

      return Response.json({ preferences: server.profiles.get(memberId) ?? null });
    },
  };

  return server;
}
