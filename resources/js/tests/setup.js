import { afterEach, vi } from "vite-plus/test";
import { cleanupVue } from "./vue-test-helpers";

afterEach(function cleanup() {
  cleanupVue();
  vi.useRealTimers();

  if (typeof window !== "undefined") {
    document.body.innerHTML = "";
    document.documentElement.classList.remove("dark-mode");
    window.localStorage.clear();
  }
});
