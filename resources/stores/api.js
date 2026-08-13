import { computed, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import * as z from "zod/v4";
import LiveClient, { authenticateGroup } from "../api/live-client";
import { useLocalStorage } from "../composables/local-storage";

const LOCAL_STORAGE_KEY_GROUP_NAME = "groupName";
const LOCAL_STORAGE_KEY_GROUP_TOKEN = "groupToken";
const LOCAL_STORAGE_KEY_SAVED_GROUPS = "savedGroups";
const credentialsSchema = z.object({
  name: z.string().min(1),
  token: z.string().min(1),
});

function validateCredential(value) {
  return value || undefined;
}

function readSavedGroups() {
  try {
    const groups = z
      .array(credentialsSchema)
      .safeParse(JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_SAVED_GROUPS) ?? "[]"));

    return groups.success ? groups.data : [];
  } catch {
    return [];
  }
}

export const useApiStore = defineStore("api", function createApiStore() {
  const [storedGroupName, setStoredGroupName] = useLocalStorage({
    key: LOCAL_STORAGE_KEY_GROUP_NAME,
    defaultValue: undefined,
    validator: validateCredential,
  });
  const [storedGroupToken, setStoredGroupToken] = useLocalStorage({
    key: LOCAL_STORAGE_KEY_GROUP_TOKEN,
    defaultValue: undefined,
    validator: validateCredential,
  });
  const client = shallowRef();
  const isDemo = ref(false);
  const savedGroups = ref(readSavedGroups());

  const storedCredentials = computed(function getStoredCredentials() {
    if (!storedGroupName.value || !storedGroupToken.value) {
      return undefined;
    }

    return { name: storedGroupName.value, token: storedGroupToken.value };
  });
  const credentials = computed(function getCredentials() {
    return client.value?.credentials;
  });
  const hasStoredCredentials = computed(function hasCredentialsInStorage() {
    return storedCredentials.value !== undefined;
  });

  function saveGroups(groups) {
    localStorage.setItem(LOCAL_STORAGE_KEY_SAVED_GROUPS, JSON.stringify(groups));
    savedGroups.value = groups;
  }

  function saveGroup(credentialsToSave) {
    const otherGroups = readSavedGroups().filter(function isDifferentGroup(group) {
      return group.name !== credentialsToSave.name || group.token !== credentialsToSave.token;
    });

    saveGroups([...otherGroups, credentialsToSave]);
  }

  function logOut() {
    setStoredGroupName(undefined);
    setStoredGroupToken(undefined);
    disconnect();
  }

  function disconnect() {
    client.value = undefined;
    isDemo.value = false;
  }

  async function logInLive(credentialsToUse = storedCredentials.value) {
    if (!credentialsToUse) {
      throw new Error("No credentials are available.");
    }

    const response = await authenticateGroup(credentialsToUse);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Name or token is invalid.");
      }

      throw new Error(`Unexpected status code: ${response.status}`);
    }

    setStoredGroupName(credentialsToUse.name);
    setStoredGroupToken(credentialsToUse.token);
    saveGroup(credentialsToUse);
    client.value = new LiveClient(credentialsToUse);
    isDemo.value = false;
  }

  async function logInDemo() {
    const { default: DemoClient } = await import("../api/demo-client");
    client.value = new DemoClient();
    isDemo.value = true;
  }

  function removeSavedGroup(credentialsToRemove) {
    const remainingGroups = readSavedGroups()
      .filter(function isDifferentGroup(group) {
        return group.name !== credentialsToRemove.name || group.token !== credentialsToRemove.token;
      })
      .sort(function sortGroups(left, right) {
        return left.name.localeCompare(right.name);
      });

    saveGroups(remainingGroups);

    if (storedGroupName.value !== credentialsToRemove.name) {
      return;
    }

    if (remainingGroups.length > 0) {
      logInLive(remainingGroups[0]).catch(logOut);
    } else {
      logOut();
    }
  }

  return {
    client,
    credentials,
    isDemo,
    hasStoredCredentials,
    savedGroups,
    logOut,
    disconnect,
    logInLive,
    logInDemo,
    removeSavedGroup,
  };
});
