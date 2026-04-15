import { useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { type GroupCredentials } from "../api/credentials";
import * as RequestSkillData from "../api/requests/skill-data";
import { createContext } from "react";
import Api from "../api/api";
import { type GroupMode } from "../game/group-mode";
import { useLocalStorage } from "../hooks/local-storage";
import type DemoApi from "../api/demo-api";
import { useSavedGroups } from "../hooks/saved-groups";

/**
 * Public methods to interact with the backend.
 */
interface APIMethods {
  /**
   * For a given aggregate period, fetch the skill data for the group whose
   * credentials are loaded by the API.
   */
  fetchSkillData: (period: RequestSkillData.AggregatePeriod) => Promise<RequestSkillData.Response>;

  setUpdateCallbacks: Api["overwriteSomeUpdateCallbacks"];

  renameMember: Api["renameGroupMember"];
  addMember: Api["addGroupMember"];
  deleteMember: Api["deleteGroupMember"];

  fetchGroupCollectionLogs?: Api["fetchGroupCollectionLogs"];

  fetchMemberHiscores: Api["fetchMemberHiscores"];

  getCredentials: Api["getCredentials"];
}

interface APIContext {
  loaded: true;
  isDemo: boolean;
  selectedGroupMode: GroupMode;
  setSelectedGroupMode: (mode: GroupMode) => void;

  /**
   * Delete the credentials from persistent storage, and close any active API
   * connections.
   */
  logOut: () => void;

  /**
   * Open a live API connection to the backend. Credentials can be undefined, in
   * which case stored credentials (such as in local storage) will be used. If
   * successful, any existing API connection is overwritten.
   *
   * If the credentials are valid and a new API is successfully created, it
   * automatically starts updating the group state and the returned promise
   * resolves. Also, the utilized credentials will be saved in
   * persistent storage.
   *
   * If no valid credentials are available, the promise will reject.
   * In this case, the current state is unchanged.
   */
  logInLive: (credentials?: GroupCredentials) => Promise<void>;

  /**
   * Resolves with whether or not the passed credentials are valid.
   * Credentials can be undefined, in which case stored credentials (such as
   * in local storage) will be used. This does not interact with any
   * existing API connection.
   *
   * Resolves with a boolean indicating whether or not the credentials are
   * valid.
   */
  checkCredentials: (credentials?: GroupCredentials) => Promise<boolean>;

  /**
   * Open a demo API connection, which mocks the backend with a fake group.
   * If successful, any existing API connection is overwritten.
   *
   * If a new API is successfully created, it automatically starts updating
   * the group state and the returned promise resolves.
   */
  logInDemo: () => Promise<boolean>;

  /**
   * All saved group credentials that the user has previously logged into.
   */
  savedGroups: GroupCredentials[];

  /**
   * Remove a saved group by name.
   */
  removeSavedGroup: (credentials: GroupCredentials) => void;

  api?: APIMethods;
}

// eslint-disable-next-line react-refresh/only-export-components
export const Context = createContext<APIContext | undefined>(undefined);

const LOCAL_STORAGE_KEY_GROUP_NAME = "groupName";
const LOCAL_STORAGE_KEY_GROUP_TOKEN = "groupToken";
const LOCAL_STORAGE_KEY_GROUP_MODE = "groupMode";

/**
 * Client-side check that the credentials are a valid string.
 */
const validateCredential = (value: string | undefined): string | undefined => {
  if (!value || value === "") return undefined;
  return value;
};

const validateGroupMode = (value: string | undefined): GroupMode | undefined => {
  if (value === "Normal" || value === "Leagues") {
    return value;
  }

  return undefined;
};

export const APIProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const [groupName, setGroupName] = useLocalStorage({
    key: LOCAL_STORAGE_KEY_GROUP_NAME,
    defaultValue: undefined,
    validator: validateCredential,
  });
  const [groupToken, setGroupToken] = useLocalStorage({
    key: LOCAL_STORAGE_KEY_GROUP_TOKEN,
    defaultValue: undefined,
    validator: validateCredential,
  });
  const [selectedGroupMode, setStoredGroupMode] = useLocalStorage<GroupMode>({
    key: LOCAL_STORAGE_KEY_GROUP_MODE,
    defaultValue: "Normal",
    validator: validateGroupMode,
  });

  const { savedGroups, addGroup, removeGroup } = useSavedGroups();

  const storageCredentials: GroupCredentials | undefined = useMemo(() => {
    if (!groupName || !groupToken) return undefined;
    return { name: groupName, token: groupToken };
  }, [groupName, groupToken]);

  const [api, setApi] = useState<Api | DemoApi>();
  const [isDemo, setIsDemo] = useState<boolean>(false);

  useEffect(() => {
    if (!api) return;
    return (): void => api.close();
  }, [api]);

  const logOut = useCallback((): void => {
    setGroupName(undefined);
    setGroupToken(undefined);
    setApi(undefined);
    setIsDemo(false);
  }, [setGroupName, setGroupToken]);
  const setSelectedGroupMode = useCallback(
    (mode: GroupMode): void => {
      setStoredGroupMode(mode);

      if (!storageCredentials || isDemo) {
        return;
      }

      setApi(new Api(storageCredentials, mode));
    },
    [isDemo, setStoredGroupMode, storageCredentials],
  );
  const logInLive = useCallback(
    (credentials?: GroupCredentials): Promise<void> => {
      const newCredentials = credentials ?? storageCredentials;
      if (!newCredentials) {
        return Promise.reject(new Error("No credentials provided nor available in storage."));
      }

      return Api.fetchAmILoggedIn(newCredentials).then((response) => {
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Name or token is invalid.");
          }

          throw new Error(`Unexpected status code: ${response.status}`);
        }

        setGroupName(newCredentials.name);
        setGroupToken(newCredentials.token);
        addGroup(newCredentials);
        setApi(new Api(newCredentials, selectedGroupMode));
        setIsDemo(false);
        return Promise.resolve();
      });
    },
    [addGroup, selectedGroupMode, setGroupName, setGroupToken, storageCredentials],
  );
  const logInDemo = useCallback(async (): Promise<boolean> => {
    const { default: DemoApi } = await import("../api/demo-api");
    setApi(new DemoApi());
    setIsDemo(true);
    return true;
  }, []);
  const checkCredentials = useCallback(
    (credentials?: GroupCredentials): Promise<boolean> => {
      const newCredentials = credentials ?? storageCredentials;
      if (!newCredentials) {
        return Promise.reject(new Error("checkCredentials: No credentials provided, and none in storage."));
      }

      return Api.fetchAmILoggedIn(newCredentials).then((response) => response.ok);
    },
    [storageCredentials],
  );

  const removeSavedGroup = useCallback(
    (credentials: GroupCredentials): void => {
      const remaining = [...removeGroup(credentials)].sort((a, b) => a.name.localeCompare(b.name));
      if (groupName === credentials.name) {
        if (remaining.length > 0) {
          logInLive(remaining[0]).catch(() => logOut());
        } else {
          logOut();
        }
      }
    },
    [removeGroup, groupName, logInLive, logOut],
  );

  const apiContext: APIContext = useMemo(() => {
    const base: APIContext = {
      loaded: true,
      isDemo,
      selectedGroupMode,
      setSelectedGroupMode,
      logOut,
      logInLive,
      logInDemo,
      checkCredentials,
      savedGroups,
      removeSavedGroup,
    };

    if (!api) return base;

    base.api = {
      fetchSkillData: api.fetchSkillData.bind(api),
      setUpdateCallbacks: api.overwriteSomeUpdateCallbacks.bind(api),
      addMember: api.addGroupMember.bind(api),
      deleteMember: api.deleteGroupMember.bind(api),
      renameMember: api.renameGroupMember.bind(api),
      getCredentials: api.getCredentials.bind(api),
      fetchMemberHiscores: api.fetchMemberHiscores.bind(api),
      fetchGroupCollectionLogs: api.fetchGroupCollectionLogs.bind(api),
    };

    return base;
  }, [
    api,
    checkCredentials,
    isDemo,
    logInDemo,
    logInLive,
    logOut,
    removeSavedGroup,
    savedGroups,
    selectedGroupMode,
    setSelectedGroupMode,
  ]);

  return <Context value={apiContext}>{children}</Context>;
};
