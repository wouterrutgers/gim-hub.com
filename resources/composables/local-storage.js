import { onScopeDispose, ref } from "vue";

export function useLocalStorage({ key, defaultValue, validator }) {
  const stored = validator(localStorage.getItem(key) ?? undefined);
  const value = ref(stored ?? defaultValue);

  function handleStorageEvent(event) {
    const eventKey = event.type === "local-storage" ? event.detail?.key : (event.key ?? undefined);

    if (!eventKey || eventKey !== key) {
      return;
    }

    value.value = validator(localStorage.getItem(eventKey) ?? undefined) ?? defaultValue;
  }

  function setValue(newValue) {
    if (typeof newValue === "undefined") {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, newValue);
    }

    window.dispatchEvent(new CustomEvent("local-storage", { detail: { key } }));
  }

  window.addEventListener("local-storage", handleStorageEvent);
  window.addEventListener("storage", handleStorageEvent);

  onScopeDispose(function cleanupLocalStorageListeners() {
    window.removeEventListener("local-storage", handleStorageEvent);
    window.removeEventListener("storage", handleStorageEvent);
  });

  return [value, setValue];
}
