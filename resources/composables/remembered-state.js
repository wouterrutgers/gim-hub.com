import { ref } from "vue";

const rememberedValues = new Map();

export function useRememberedState({ key, defaultValue }) {
  const value = ref(rememberedValues.has(key) ? rememberedValues.get(key) : defaultValue);

  function setValue(newValue) {
    if (typeof newValue === "undefined") {
      rememberedValues.delete(key);
      value.value = defaultValue;

      return;
    }

    rememberedValues.set(key, newValue);
    value.value = newValue;
  }

  return [value, setValue];
}
