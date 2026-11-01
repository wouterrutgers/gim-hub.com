// @vitest-environment jsdom

import { nextTick } from "vue";
import { setActivePinia } from "pinia";
import { createMemoryHistory } from "vue-router";
import { describe, expect, it, vi } from "vite-plus/test";
import { createTestApplication, createTestPinia } from "./vue-test-helpers";
import { createApplicationRouter } from "../../router";
import { useApiStore } from "../../stores/api";
import { useImageStore } from "../../stores/images";
import GroupSwitcher from "../../components/group-switcher/GroupSwitcher.vue";

describe("saved group switching", function savedGroupSwitching() {
  it("keeps saved logins and the current session when switching returns 503", async function failedSwitch() {
    const groups = [
      { name: "First group", token: "first-token" },
      { name: "Second group", token: "second-token" },
    ];
    const { container, apiStore } = await mountSwitcher(groups);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    container.querySelector('[aria-label="Switch to group Second group"]').click();

    await vi.waitFor(function switchErrorIsVisible() {
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
    });
    expect(JSON.parse(localStorage.getItem("savedGroups"))).toEqual(groups);
    expect(apiStore.credentials).toEqual(groups[0]);
  });

  it("returns home after removing the last saved group", async function removeLastGroup() {
    const { container, router, apiStore } = await mountSwitcher([{ name: "First group", token: "first-token" }]);

    container.querySelector('[aria-label="Forget saved login for First group"]').click();

    await vi.waitFor(function returnedHome() {
      expect(router.currentRoute.value.path).toBe("/");
    });
    expect(apiStore.client).toBeUndefined();
    expect(JSON.parse(localStorage.getItem("savedGroups"))).toEqual([]);
  });
});

async function mountSwitcher(groups) {
  localStorage.setItem("savedGroups", JSON.stringify(groups));
  localStorage.setItem("groupName", groups[0].name);
  localStorage.setItem("groupToken", groups[0].token);
  const pinia = createTestPinia();
  setActivePinia(pinia);
  vi.spyOn(useImageStore(pinia), "getImageUrl").mockResolvedValue("/ui/1731-0.png");
  const apiStore = useApiStore(pinia);
  apiStore.client = { credentials: groups[0] };
  const router = createApplicationRouter(createMemoryHistory());
  await router.push("/group/items");
  const application = createTestApplication(GroupSwitcher, { groupName: groups[0].name });
  application.use(pinia);
  application.use(router);
  const container = document.createElement("div");
  document.body.append(container);
  application.mount(container);
  container.querySelector("#group-switcher-toggle").click();
  await nextTick();

  return { container, apiStore, router };
}
