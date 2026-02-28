import { useCallback, useState } from "react";
import { type GroupCredentials } from "../api/credentials";

const LOCAL_STORAGE_KEY_SAVED_GROUPS = "savedGroups";

const readFromStorage = (): GroupCredentials[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_SAVED_GROUPS);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown): item is GroupCredentials =>
        typeof item === "object" && item !== null && "name" in item && "token" in item,
    );
  } catch {
    return [];
  }
};

export const useSavedGroups = (): {
  savedGroups: GroupCredentials[];
  addGroup: (credentials: GroupCredentials) => void;
  removeGroup: (name: string) => GroupCredentials[];
} => {
  const [savedGroups, setSavedGroups] = useState<GroupCredentials[]>(readFromStorage);

  const writeToStorage = useCallback((groups: GroupCredentials[]): void => {
    localStorage.setItem(LOCAL_STORAGE_KEY_SAVED_GROUPS, JSON.stringify(groups));
    setSavedGroups(groups);
  }, []);

  const addGroup = useCallback(
    (credentials: GroupCredentials): void => {
      const current = readFromStorage();
      const filtered = current.filter((g) => g.name !== credentials.name);
      writeToStorage([...filtered, credentials]);
    },
    [writeToStorage],
  );

  const removeGroup = useCallback(
    (name: string): GroupCredentials[] => {
      const current = readFromStorage();
      const remaining = current.filter((g) => g.name !== name);
      writeToStorage(remaining);
      return remaining;
    },
    [writeToStorage],
  );

  return { savedGroups, addGroup, removeGroup };
};
