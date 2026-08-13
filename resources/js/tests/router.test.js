// @vitest-environment jsdom

import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createApplicationRouter } from "../../router";
import { useApiStore } from "../../stores/api";

function createTestRouter() {
  return createApplicationRouter(createMemoryHistory());
}

function storeCredentials() {
  localStorage.setItem("groupName", "Group name");
  localStorage.setItem("groupToken", "group-token");
}

describe("router", function describeRouter() {
  beforeEach(function setup() {
    setActivePinia(createPinia());
  });

  afterEach(function cleanup() {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("opens the demo before redirecting to group items", async function testDemoRoute() {
    const apiStore = useApiStore();
    vi.spyOn(apiStore, "logInDemo").mockImplementation(async function logInDemo() {
      apiStore.client = {};
      apiStore.isDemo = true;
    });
    const router = createTestRouter();

    await router.push("/demo");

    expect(apiStore.logInDemo).toHaveBeenCalledOnce();
    expect(router.currentRoute.value.path).toBe("/group/items");
  });

  it("disconnects a demo session during logout", async function testDemoLogout() {
    const apiStore = useApiStore();
    apiStore.client = {};
    apiStore.isDemo = true;
    const disconnect = vi.spyOn(apiStore, "disconnect");
    const router = createTestRouter();

    await router.push("/logout");

    expect(disconnect).toHaveBeenCalledOnce();
    expect(router.currentRoute.value.path).toBe("/");
  });

  it("restores a stored session before opening an authenticated route", async function testSessionRestore() {
    storeCredentials();
    const apiStore = useApiStore();
    vi.spyOn(apiStore, "logInLive").mockImplementation(async function logInLive() {
      apiStore.client = {};
    });
    const router = createTestRouter();

    await router.push("/group/history");

    expect(apiStore.logInLive).toHaveBeenCalledOnce();
    expect(router.currentRoute.value.path).toBe("/group/history");
  });

  it("returns home when a stored session cannot be restored", async function testFailedSessionRestore() {
    storeCredentials();
    const apiStore = useApiStore();
    vi.spyOn(apiStore, "logInLive").mockRejectedValue(new Error("Invalid credentials"));
    const logOut = vi.spyOn(apiStore, "logOut");
    const router = createTestRouter();

    await router.push("/group/history");

    expect(logOut).toHaveBeenCalledOnce();
    expect(router.currentRoute.value.path).toBe("/");
  });

  it("redirects stored sessions away from the login page", async function testLoginRedirect() {
    storeCredentials();
    const apiStore = useApiStore();
    vi.spyOn(apiStore, "logInLive").mockImplementation(async function logInLive() {
      apiStore.client = {};
    });
    const router = createTestRouter();

    await router.push("/login");

    expect(router.currentRoute.value.path).toBe("/group/items");
  });
});
