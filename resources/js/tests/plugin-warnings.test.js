// @vitest-environment jsdom

import { nextTick } from "vue";
import { expect, it, vi } from "vite-plus/test";
import { createTestApplication, createTestPinia } from "./vue-test-helpers";
import PluginWarnings from "../../components/layout/PluginWarnings.vue";
import { useApiStore } from "../../stores/api";
import { useImageStore } from "../../stores/images";
import { parseGroupData } from "../../api/requests/group-data";

it("keeps a dismissed warning closed after remounting until the latest plugin version changes", async function testWarningDismissal() {
  vi.useFakeTimers();
  let latestVersion = "1.9.1";
  const pinia = createTestPinia();
  vi.spyOn(useImageStore(pinia), "getImageUrl").mockResolvedValue("");
  useApiStore(pinia).client = {
    async fetchGameData() {
      return { quests: new Map() };
    },
    async fetchGroupCollectionLogs() {
      return new Map();
    },
    async fetchGroupData() {
      return parseGroupData([
        {
          name: "Alice",
          last_online_at: new Date().toISOString(),
          plugin_status: { reason: "update_available", installed_version: "1.9.0", latest_version: latestVersion },
        },
      ]);
    },
  };
  const container = document.createElement("div");
  document.body.append(container);
  let application = createTestApplication(PluginWarnings);
  application.use(pinia);
  application.mount(container);
  await vi.advanceTimersByTimeAsync(0);
  await nextTick();

  container.querySelector('button[aria-label="Close plugin warning"]').click();
  await nextTick();
  expect(container.querySelector('[role="status"]')).toBeNull();

  application.unmount();
  application = createTestApplication(PluginWarnings);
  application.use(pinia);
  application.mount(container);
  await vi.advanceTimersByTimeAsync(1000);
  await nextTick();
  expect(container.querySelector('[role="status"]')).toBeNull();

  latestVersion = "1.9.2";
  await vi.advanceTimersByTimeAsync(1000);
  await nextTick();
  expect(container.querySelector('[role="status"]').textContent).toContain("1.9.2");
});

it("updates member warnings through polling and clears them on recovery or group switch", async function testPluginWarnings() {
  vi.useFakeTimers();
  const lastOnlineAt = new Date().toISOString();
  let payload = [
    {
      name: "Alice",
      last_online_at: lastOnlineAt,
      plugin_status: { reason: "wrong_plugin", installed_version: "1.7.0", latest_version: "1.9.1" },
    },
    {
      name: "Bob",
      last_online_at: lastOnlineAt,
      plugin_status: { reason: "update_available", installed_version: "1.9.0", latest_version: "1.9.1" },
    },
  ];
  const client = {
    async fetchGameData() {
      return { quests: new Map() };
    },
    async fetchGroupCollectionLogs() {
      return new Map();
    },
    async fetchGroupData() {
      return parseGroupData(payload);
    },
  };
  const pinia = createTestPinia();
  vi.spyOn(useImageStore(pinia), "getImageUrl").mockResolvedValue("");
  const apiStore = useApiStore(pinia);
  apiStore.client = client;
  const container = document.createElement("div");
  document.body.append(container);
  const application = createTestApplication(PluginWarnings);
  application.use(pinia);
  application.mount(container);

  await vi.advanceTimersByTimeAsync(0);
  await nextTick();
  expect(
    [...container.querySelectorAll("li strong")].map(function memberName(element) {
      return element.textContent;
    }),
  ).toEqual(["Alice", "Bob"]);
  expect(container.querySelectorAll("li")[1].textContent).toContain("1.9.0");
  expect(container.querySelectorAll("li")[1].textContent).toContain("1.9.1");

  payload = [
    { name: "Alice", plugin_status: null },
    { name: "Bob", plugin_status: null },
  ];
  await vi.advanceTimersByTimeAsync(1000);
  await nextTick();
  expect(container.querySelector('[role="status"]')).toBeNull();

  payload = [
    {
      name: "Alice",
      last_online_at: lastOnlineAt,
      plugin_status: { reason: "update_available", installed_version: null, latest_version: "1.9.1" },
    },
  ];
  await vi.advanceTimersByTimeAsync(1000);
  await nextTick();
  expect(container.querySelector("li strong").textContent).toBe("Alice");

  apiStore.client = {
    ...client,
    async fetchGroupData() {
      return [{ name: "Carol" }];
    },
  };
  await vi.advanceTimersByTimeAsync(0);
  await nextTick();
  expect(container.querySelector('[role="status"]')).toBeNull();
});

it("expires plugin notices after 30 minutes of inactivity and restores them when activity resumes", async function testRecentMemberWarnings() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
  const payload = [
    {
      name: "Alice",
      last_online_at: "2026-09-30T11:30:01.000Z",
      plugin_status: { reason: "wrong_plugin", installed_version: "1.7.0", latest_version: "1.9.1" },
    },
    {
      name: "Bob",
      last_online_at: "2026-09-30T11:30:01.000Z",
      plugin_status: { reason: "update_available", installed_version: "1.9.0", latest_version: "1.9.1" },
    },
    {
      name: "Carol",
      last_online_at: "2026-09-30T11:30:00.000Z",
      plugin_status: { reason: "wrong_plugin", installed_version: "1.7.0", latest_version: "1.9.1" },
    },
    {
      name: "Dave",
      last_online_at: "2026-09-30T11:00:00.000Z",
      plugin_status: { reason: "update_available", installed_version: "1.9.0", latest_version: "1.9.1" },
    },
    {
      name: "Eve",
      plugin_status: { reason: "update_available", installed_version: "1.9.0", latest_version: "1.9.1" },
    },
  ];
  let resumeActivity;
  const activityUpdate = new Promise(function waitForActivity(resolve) {
    resumeActivity = resolve;
  });
  const pinia = createTestPinia();
  vi.spyOn(useImageStore(pinia), "getImageUrl").mockResolvedValue("");
  useApiStore(pinia).client = {
    async fetchGameData() {
      return { quests: new Map() };
    },
    async fetchGroupCollectionLogs() {
      return new Map();
    },
    fetchGroupData: vi.fn().mockResolvedValueOnce(parseGroupData(payload)).mockReturnValue(activityUpdate),
  };
  const container = document.createElement("div");
  document.body.append(container);
  const application = createTestApplication(PluginWarnings);
  application.use(pinia);
  application.mount(container);

  await vi.advanceTimersByTimeAsync(0);
  await nextTick();
  expect(
    [...container.querySelectorAll("li strong")].map(function memberName(element) {
      return element.textContent;
    }),
  ).toEqual(["Alice", "Bob"]);

  await vi.advanceTimersByTimeAsync(1000);
  await nextTick();
  expect(container.querySelector('[role="status"]')).toBeNull();

  payload[0].last_online_at = new Date().toISOString();
  payload[1].last_online_at = new Date().toISOString();
  resumeActivity(parseGroupData(payload));
  await vi.advanceTimersByTimeAsync(0);
  await nextTick();
  expect(
    [...container.querySelectorAll("li strong")].map(function memberName(element) {
      return element.textContent;
    }),
  ).toEqual(["Alice", "Bob"]);
});
