import { useCallback, useState } from "react";

const rememberedValues = new Map<string, unknown>();

interface UseRememberedStateProps<Value> {
  key: string;
  defaultValue: Value;
}

export function useRememberedState<Value>({
  key,
  defaultValue,
}: UseRememberedStateProps<Value>): [Value, (value: Value | undefined) => void] {
  const [value, setValue] = useState<Value>(() =>
    rememberedValues.has(key) ? (rememberedValues.get(key) as Value) : defaultValue,
  );

  const set = useCallback(
    (value: Value | undefined): void => {
      if (typeof value === "undefined") {
        rememberedValues.delete(key);
        setValue(defaultValue);
        return;
      }

      rememberedValues.set(key, value);
      setValue(value);
    },
    [key, defaultValue],
  );

  return [value, set];
}
