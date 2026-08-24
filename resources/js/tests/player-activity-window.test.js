// @vitest-environment jsdom

import { createPinia } from "pinia";
import { createApp, nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import PlayerActivityWindow from "../../components/player-activity/PlayerActivityWindow.vue";
import { useApiStore } from "../../stores/api";
import { useGroupStore } from "../../stores/group";

describe("player activity window", function describePlayerActivityWindow() {
  let app;
  let apiStore;

  afterEach(async function cleanup() {
    app?.unmount();
    apiStore?.disconnect();
    await nextTick();
    document.body.innerHTML = "";
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("refreshes collection logs and hiscores when opened", async function testActivityRefresh() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async function fetchImageChunk() {
        return {
          ok: true,
          async json() {
            return {
              "/item-icons/227.webp": "/hashed/item-icons/227.webp",
              "/ui/1731-0.png": "/hashed/ui/1731-0.png",
            };
          },
        };
      }),
    );

    const player = "Test player";
    const snapshot = {
      timestamp: Date.now() - 60_000,
      skills: {},
      quests: {},
      diaries: {},
      collection: {},
      bossKc: { "Abyssal Sire": 10 },
    };
    let collectionLogs = new Map([[player, new Map()]]);
    const client = {
      credentials: { name: "Test group", token: "test token" },
      fetchGameData: vi.fn(async function fetchGameData() {
        return {
          diaries: new Map(),
          items: new Map([[227, { name: "Fresh drop" }]]),
          quests: new Map(),
        };
      }),
      fetchGroupCollectionLogs: vi.fn(async function fetchGroupCollectionLogs() {
        return collectionLogs;
      }),
      fetchGroupData: vi.fn(async function fetchGroupData() {
        return [{ name: player }];
      }),
      fetchMemberHiscores: vi.fn(async function fetchMemberHiscores() {
        return new Map([["Abyssal Sire", 12]]);
      }),
      fetchMemberSnapshots: vi.fn(async function fetchMemberSnapshots() {
        return new Map([[player, { lastVisit: snapshot, lastWeek: snapshot }]]);
      }),
    };
    const pinia = createPinia();
    apiStore = useApiStore(pinia);
    apiStore.client = client;
    const groupStore = useGroupStore(pinia);

    await vi.waitFor(function initialCollectionLogsLoaded() {
      expect(groupStore.collectionLogsLoaded).toBe(true);
    });
    expect(groupStore.collections.get(player)).toEqual(new Map());

    collectionLogs = new Map([[player, new Map([[227, 1]])]]);
    const container = document.createElement("div");
    document.body.append(container);
    app = createApp(PlayerActivityWindow, { player });
    app.use(pinia);
    app.mount(container);

    await vi.waitFor(function activityDataRendered() {
      expect(client.fetchGroupCollectionLogs).toHaveBeenCalledTimes(2);
      expect(client.fetchMemberHiscores).toHaveBeenCalledWith(player);
      expect(container.querySelector(".player-activity-collection-name")?.textContent).toBe("Fresh drop");
      expect(container.querySelector(".player-activity-bosskc-change")?.textContent).toBe("10→12");
    });
  });
});
