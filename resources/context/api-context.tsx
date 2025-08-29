import { useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { type GroupCredentials } from "../api/credentials";
import * as RequestSkillData from "../api/requests/skill-data";
import { createContext } from "react";
import Api from "../api/api";
import { useLocalStorage } from "../hooks/local-storage";
import DemoApi from "../api/demo-api";

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

  getCredentials: Api["getCredentials"];
}

interface APIContext {
  loaded: true;

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

  api?: APIMethods;
}

// eslint-disable-next-line react-refresh/only-export-components
export const Context = createContext<APIContext | undefined>(undefined);

const LOCAL_STORAGE_KEY_GROUP_NAME = "groupName";
const LOCAL_STORAGE_KEY_GROUP_TOKEN = "groupToken";

/**
 * Client-side check that the credentials are a valid string.
 */
const validateCredential = (value: string | undefined): string | undefined => {
  if (!value || value === "") return undefined;
  return value;
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

  const storageCredentials: GroupCredentials | undefined = useMemo(() => {
    if (!groupName || !groupToken) return undefined;
    return { name: groupName, token: groupToken };
  }, [groupName, groupToken]);

  const [api, setApi] = useState<Api | DemoApi>();

  useEffect(() => {
    if (!api) return;
    return (): void => api.close();
  }, [api]);

  const logOut = useCallback((): void => {
    setGroupName(undefined);
    setGroupToken(undefined);
    setApi(undefined);
  }, [setGroupName, setGroupToken]);
  const logInLive = useCallback(
    (credentials?: GroupCredentials): Promise<void> => {
      const newCredentials = credentials ?? storageCredentials;
      if (!newCredentials) {
        return Promise.reject(new Error("No credentials provided nor available in storage."));
      }

      return Api.fetchAmILoggedIn(newCredentials).then((response) => {
        if (response.ok) {
          setGroupName(newCredentials.name);
          setGroupToken(newCredentials.token);
          setApi(new Api(newCredentials));
          return Promise.resolve();
        }

        if (response.status === 401) {
          throw new Error("Name or token is invalid.");
        }

        throw new Error(`Unexpected status code: ${response.status}`);
      });
    },
    [setGroupName, setGroupToken, storageCredentials],
  );
  const logInDemo = useCallback((): Promise<boolean> => {
    setApi(new DemoApi());
    return Promise.resolve(true);
  }, []);
  const checkCredentials = useCallback(
    (credentials?: GroupCredentials): Promise<boolean> => {
      const newCredentials = credentials ?? storageCredentials;
      if (!newCredentials) {
        return Promise.reject(new Error("checkCredentials: No credentials provided, and none in storage."));
      }

      return Api.fetchAmILoggedIn(newCredentials).then((response) => {
        return response.ok;
      });
    },
    [storageCredentials],
  );

  const apiContext: APIContext = useMemo(() => {
    const base: APIContext = {
      loaded: true,
      logOut,
      logInLive,
      logInDemo,
      checkCredentials,
    };

    if (!api) return base;

    /* eslint-disable @typescript-eslint/explicit-function-return-type */
    base.api = {
      fetchSkillData: api.fetchSkillData.bind(api),
      setUpdateCallbacks: api.overwriteSomeUpdateCallbacks.bind(api),
      addMember: api.addGroupMember.bind(api),
      deleteMember: api.deleteGroupMember.bind(api),
      renameMember: api.renameGroupMember.bind(api),
      getCredentials: api.getCredentials.bind(api),
      fetchGroupCollectionLogs: () => api.fetchGroupCollectionLogs(),
    };
    /* eslint-enable @typescript-eslint/explicit-function-return-type */

    return base;
  }, [api, checkCredentials, logInDemo, logInLive, logOut]);

  return <Context value={apiContext}>{children}</Context>;
};
