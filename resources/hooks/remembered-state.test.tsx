// @vitest-environment jsdom

import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useRememberedState } from "./remembered-state";

describe("useRememberedState", (): void => {
  let root: Root | undefined;

  afterEach((): void => {
    act((): void => root?.unmount());
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("remembers state across component remounts without using local storage", (): void => {
    const key = "remembered-state-test";
    localStorage.setItem(key, "persisted value");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    let setRememberedState: ((value: string | undefined) => void) | undefined;

    function Consumer(): ReactElement {
      const [value, setValue] = useRememberedState({ key, defaultValue: "default value" });
      setRememberedState = setValue;

      return <span>{value}</span>;
    }

    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act((): void => root?.render(<Consumer />));
    expect(container.textContent).toBe("default value");

    act((): void => setRememberedState?.("remembered value"));
    expect(container.textContent).toBe("remembered value");

    act((): void => root?.unmount());
    root = createRoot(container);
    act((): void => root?.render(<Consumer />));

    expect(container.textContent).toBe("remembered value");

    act((): void => setRememberedState?.(undefined));
    expect(container.textContent).toBe("default value");
    expect(setItem).not.toHaveBeenCalled();
  });
});
