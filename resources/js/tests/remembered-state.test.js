// @vitest-environment jsdom

import { createApp, defineComponent, h, nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useRememberedState } from "../../composables/remembered-state";

describe("useRememberedState", function describeRememberedState() {
  let app;

  afterEach(function cleanup() {
    app?.unmount();
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("remembers state across component remounts without using local storage", async function testRememberedState() {
    const key = "remembered-state-test";
    localStorage.setItem(key, "persisted value");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    let setRememberedState;

    const Consumer = defineComponent({
      setup() {
        const [value, setValue] = useRememberedState({ key, defaultValue: "default value" });
        setRememberedState = setValue;

        return function renderConsumer() {
          return h("span", value.value);
        };
      },
    });

    const container = document.createElement("div");
    document.body.append(container);
    app = createApp(Consumer);
    app.mount(container);
    expect(container.textContent).toBe("default value");

    setRememberedState("remembered value");
    await nextTick();
    expect(container.textContent).toBe("remembered value");

    app.unmount();
    app = createApp(Consumer);
    app.mount(container);
    expect(container.textContent).toBe("remembered value");

    setRememberedState(undefined);
    await nextTick();
    expect(container.textContent).toBe("default value");
    expect(setItem).not.toHaveBeenCalled();
  });
});
