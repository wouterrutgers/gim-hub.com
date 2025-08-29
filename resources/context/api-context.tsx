import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { type GroupCredentials } from "../api/credentials";
import * as RequestSkillData from "../api/requests/skill-data";
import { createContext } from "react";
import Api from "../api/api";
import { useLocalStorage } from "../hooks/local-storage";

interface APIContext {
  /**
   * Forcefully close the API, ending intervals and clearing member data
   * including local storage entries for credentials.
   */
  logOut?: () => void;
  logIn?: (credentials: GroupCredentials) => void;

  credentials?: GroupCredentials;

  /**
   * For a given aggregate period, fetch the skill data for the group whose
   * credentials are loaded by the API.
   */
  fetchSkillData?: (period: RequestSkillData.AggregatePeriod) => Promise<RequestSkillData.Response>;

  setUpdateCallbacks?: Api["overwriteSomeUpdateCallbacks"];

  renameMember?: Api["renameGroupMember"];
  addMember?: Api["addGroupMember"];
  deleteMember?: Api["deleteGroupMember"];
  fetchGroupCollectionLogs?: Api["fetchGroupCollectionLogs"];
}

// eslint-disable-next-line react-refresh/only-export-components
export const Context = createContext<APIContext>({});

const LOCAL_STORAGE_KEY_GROUP_NAME = "groupName";
const LOCAL_STORAGE_KEY_GROUP_TOKEN = "groupToken";

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

  const credentials: GroupCredentials | undefined = useMemo(() => {
    if (!groupName || !groupToken) return undefined;
    return { name: groupName, token: groupToken };
  }, [groupName, groupToken]);

  const [api, setApi] = useState<Api>();

  useEffect(() => {
    if (!credentials) return;
    const newApi = new Api(credentials);

    setApi(newApi);

    return (): void => {
      newApi.close();
    };
  }, [credentials]);

  const apiContext: APIContext = useMemo(() => {
    const base: APIContext = {
      logOut: (): void => {
        setGroupName(undefined);
        setGroupToken(undefined);
      },
      logIn: ({ name, token }: GroupCredentials): void => {
        setGroupName(name);
        setGroupToken(token);
      },
      credentials,
    };

    if (api?.isOpen()) {
      return {
        ...base,
        fetchSkillData: (period: RequestSkillData.AggregatePeriod) => api.fetchSkillData(period),
        setUpdateCallbacks: (callbacks: Parameters<Api["overwriteSomeUpdateCallbacks"]>[0]) =>
          api.overwriteSomeUpdateCallbacks(callbacks),
        addMember: (member) => api.addGroupMember(member),
        deleteMember: (member) => api.deleteGroupMember(member),
        renameMember: (member) => api.renameGroupMember(member),
        fetchGroupCollectionLogs: () => api.fetchGroupCollectionLogs(),
      };
    }

    return base;
  }, [api, credentials, setGroupName, setGroupToken]);

  return <Context value={apiContext}>{children}</Context>;
};
