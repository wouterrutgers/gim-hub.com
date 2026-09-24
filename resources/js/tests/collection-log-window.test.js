// @vitest-environment jsdom

import { describe, expect, it, vi } from "vite-plus/test";
import { createTestApplication, createTestPinia } from "./vue-test-helpers";
import CollectionLogWindow from "../../components/collection-log/CollectionLogWindow.vue";
import { useApiStore } from "../../stores/api";

describe("collection log window", function describeCollectionLogWindow() {
  it("counts only positive quantities as obtained slots", async function testObtainedCount() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async function fetchImageChunk() {
        return {
          ok: true,
          async json() {
            return { "/ui/1731-0.png": "/hashed/ui/1731-0.png" };
          },
        };
      }),
    );

    const pinia = createTestPinia();
    useApiStore(pinia).client = {
      async fetchGameData() {
        return { quests: new Map(), collectionLogInfo: { tabs: new Map(), uniqueSlots: 2 } };
      },
      async fetchGroupCollectionLogs() {
        return new Map([
          [
            "Alice",
            new Map([
              [4151, 0],
              [6739, 3],
            ]),
          ],
          ["Bob", new Map([[4151, 5]])],
        ]);
      },
      async fetchGroupData() {
        return [{ name: "Alice" }, { name: "Bob" }];
      },
      async fetchMemberHiscores() {
        return new Map();
      },
    };

    const container = document.createElement("div");
    document.body.append(container);
    const app = createTestApplication(CollectionLogWindow, { player: "Alice" });
    app.use(pinia);
    app.mount(container);

    await vi.waitFor(function obtainedTotalsRendered() {
      expect(container.querySelector(".collection-log-title").textContent.match(/\d+/g)).toEqual(["1", "2", "2", "2"]);
    });
  });
});
