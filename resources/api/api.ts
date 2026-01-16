import { fetchItemDataJSON, fetchItemTagsJSON, type ItemsDatabase, type ItemTags } from "../game/items";
import { fetchQuestDataJSON, type QuestDatabase, type QuestID, type QuestStatus } from "../game/quests";
import { fetchDiaryDataJSON, type DiaryDatabase } from "../game/diaries";
import type * as Member from "../game/member";
import { Vec2D, type WikiPosition2D } from "../components/canvas-map/coordinates";
import type { CollectionLogInfo } from "../game/collection-log";
import type { GroupCredentials } from "./credentials";
import { fetchGEPrices, type GEPrices } from "./requests/ge-prices";
import { fetchGroupData, type Response as GetGroupDataResponse } from "./requests/group-data";
import { fetchGroupCollectionLogs as fetchGroupCollectionLogsRequest } from "./requests/collection-log";
import { fetchCollectionLogInfo } from "./requests/collection-log-info";
import * as RequestSkillData from "./requests/skill-data";
import * as RequestCreateGroup from "./requests/create-group";
import * as RequestAddGroupMember from "./requests/add-group-member";
import * as RequestDeleteGroupMember from "./requests/delete-group-member";
import * as RequestRenameGroupMember from "./requests/rename-group-member";
import * as RequestHiscores from "./requests/hiscores";

export type GroupStateUpdate = Map<Member.Name, Partial<Member.State>>;

export interface GameData {
  items?: ItemsDatabase;
  itemTags?: ItemTags;
  quests?: QuestDatabase;
  diaries?: DiaryDatabase;
  gePrices?: GEPrices;
  collectionLogInfo?: CollectionLogInfo;
}

interface UpdateCallbacks {
  onGroupUpdate: (group: GroupStateUpdate, partial: boolean) => void;
  onGameDataUpdate: (data: GameData) => void;
}
export default class Api {
  private readonly baseURL: string;
  private closed: boolean;
  private readonly credentials: GroupCredentials;

  private getGroupDataPromise: Promise<void> | undefined;

  private groupDataValidUpToDate: Date | undefined;

  private gameData: GameData = {};

  public isOpen(): boolean {
    return !this.closed;
  }

  private updateGroupData(response: GetGroupDataResponse): void {
    const updates: GroupStateUpdate = new Map();

    for (const { name, coordinates, quests, ...rest } of response) {
      for (const [key, value] of Object.entries(rest)) {
        if (value === undefined) {
          delete rest[key as keyof typeof rest];
        }
      }
      const update = rest as Partial<Member.State>;

      if (coordinates) {
        update.coordinates = {
          coords: Vec2D.create<WikiPosition2D>({
            x: coordinates.x,
            y: coordinates.y,
          }),
          plane: coordinates.plane,
          isOnBoat: coordinates.isOnBoat,
        };
      }

      if (quests && this.gameData?.quests) {
        const questsByID = new Map<QuestID, QuestStatus>();
        // Resolve the IDs for the flattened quest progress sent by the backend
        this.gameData.quests.entries().forEach(([id, _], index) => {
          questsByID.set(id, quests.at(index) ?? "NOT_STARTED");
        });
        update.quests = questsByID;
      }

      updates.set(name, update);
    }

    this.callbacks?.onGroupUpdate?.(updates, false);
  }

  private callbacks: Partial<UpdateCallbacks> = {};

  public getCredentials(): GroupCredentials {
    return this.credentials;
  }

  public overwriteSomeUpdateCallbacks(callbacks: Partial<UpdateCallbacks>): void {
    Object.assign(this.callbacks, callbacks);

    // Invoke the callback, so they can get the current state if they missed the
    // update.

    if (callbacks.onGameDataUpdate) {
      this.callbacks.onGameDataUpdate?.(this.gameData);
    }

    if (callbacks.onGroupUpdate) {
      this.groupDataValidUpToDate = new Date(0);
    }
  }

  private queueGetGameData(): void {
    if (!this.gameData.quests) {
      fetchQuestDataJSON()
        .then((data) => {
          this.gameData.quests = data;
          this.callbacks?.onGameDataUpdate?.(this.gameData);
        })
        .catch((reason) => console.error("Failed to get quest data for API", reason));
    }
    if (!this.gameData.items) {
      fetchItemDataJSON()
        .then((data) => {
          this.gameData.items = data;
          this.callbacks?.onGameDataUpdate?.(this.gameData);
        })
        .catch((reason) => console.error("Failed to get item data for API", reason));
    }
    if (!this.gameData.itemTags) {
      fetchItemTagsJSON()
        .then((data) => {
          this.gameData.itemTags = data;
          this.callbacks?.onGameDataUpdate?.(this.gameData);
        })
        .catch((reason) => console.error("Failed to get item tags for API", reason));
    }
    if (!this.gameData.diaries) {
      fetchDiaryDataJSON()
        .then((data) => {
          this.gameData.diaries = data;
          this.callbacks?.onGameDataUpdate?.(this.gameData);
        })
        .catch((reason) => console.error("Failed to get diary data for API", reason));
    }
    if (!this.gameData.gePrices) {
      fetchGEPrices({ baseURL: this.baseURL })
        .then((data) => {
          this.gameData.gePrices = data;
          this.callbacks?.onGameDataUpdate?.(this.gameData);
        })
        .catch((reason) => console.error("Failed to get grand exchange data for API", reason));
    }
    if (!this.gameData.collectionLogInfo) {
      fetchCollectionLogInfo()
        .then((response) => {
          this.gameData.collectionLogInfo = response;
          this.callbacks?.onGameDataUpdate?.(this.gameData);
        })
        .catch((reason) => console.error("Failed to get collection log info for API", reason));
    }
  }

  private queueFetchGroupData(): void {
    const FETCH_INTERVAL_MS = 1000;
    const fetchDate = new Date((this.groupDataValidUpToDate?.getTime() ?? 0) + 1);

    this.getGroupDataPromise ??= fetchGroupData({
      baseURL: this.baseURL,
      credentials: this.credentials,
      fromTime: fetchDate,
    })
      .then((response) => {
        this.updateGroupData(response);

        const mostRecentLastUpdatedTimestamp = response.reduce<Date>((previousNewest, { lastUpdated }) => {
          if (!lastUpdated) return previousNewest;
          const memberDate = new Date(lastUpdated);
          if (memberDate < previousNewest) return previousNewest;
          return memberDate;
        }, new Date(0));

        this.groupDataValidUpToDate = mostRecentLastUpdatedTimestamp;
      })
      .catch((reason) => console.error("Failed to get group data for API", reason))
      .finally(() => {
        if (this.closed) return;

        window.setTimeout(() => {
          this.getGroupDataPromise = undefined;
          this.queueFetchGroupData();
        }, FETCH_INTERVAL_MS);
      });
  }

  close(): void {
    this.callbacks = {};
    this.closed = true;

    this.getGroupDataPromise = undefined;

    this.groupDataValidUpToDate = new Date(0);

    this.gameData = {};
  }

  constructor(credentials: GroupCredentials) {
    this.baseURL = __API_URL__;
    this.credentials = credentials;
    this.closed = false;

    this.queueGetGameData();
    this.queueFetchGroupData();
  }

  static async fetchAmILoggedIn({ name, token }: GroupCredentials): Promise<Response> {
    const url = `${__API_URL__}/group/${name}/am-i-logged-in`;
    return fetch(url, {
      headers: { Authorization: token },
    });
  }
  static async fetchCreateGroup(groupName: string, memberNames: Member.Name[]): Promise<RequestCreateGroup.Response> {
    return RequestCreateGroup.fetchCreateGroup(groupName, memberNames);
  }

  async fetchSkillData(period: RequestSkillData.AggregatePeriod): Promise<RequestSkillData.Response> {
    if (this.credentials === undefined) return Promise.reject(new Error("No active API connection."));

    return RequestSkillData.fetchSkillData({ baseURL: this.baseURL, credentials: this.credentials, period });
  }

  async addGroupMember(member: Member.Name): Promise<RequestAddGroupMember.Response> {
    if (this.credentials === undefined) return Promise.reject(new Error("No active API connection."));
    return RequestAddGroupMember.addGroupMember({ baseURL: this.baseURL, credentials: this.credentials, member });
  }
  async renameGroupMember({
    oldName,
    newName,
  }: {
    oldName: Member.Name;
    newName: Member.Name;
  }): Promise<RequestRenameGroupMember.Response> {
    if (this.credentials === undefined) return Promise.reject(new Error("No active API connection."));
    return RequestRenameGroupMember.renameGroupMember({
      baseURL: this.baseURL,
      credentials: this.credentials,
      oldName,
      newName,
    });
  }
  async deleteGroupMember(member: Member.Name): Promise<RequestDeleteGroupMember.Response> {
    if (this.credentials === undefined) return Promise.reject(new Error("No active API connection."));
    return RequestDeleteGroupMember.deleteGroupMember({ baseURL: this.baseURL, credentials: this.credentials, member });
  }

  async fetchGroupCollectionLogs(): Promise<void> {
    if (this.credentials === undefined) return Promise.reject(new Error("No active API connection."));
    const collections = await fetchGroupCollectionLogsRequest({
      baseURL: this.baseURL,
      credentials: this.credentials,
    });
    const updates = new Map<Member.Name, Partial<Member.State>>();
    for (const [name, collection] of Object.entries(collections)) {
      updates.set(name as Member.Name, { collection });
    }
    this.callbacks?.onGroupUpdate?.(updates, true);
  }

  async fetchMemberHiscores(memberName: string): Promise<RequestHiscores.Response> {
    if (this.credentials === undefined) return Promise.reject(new Error("No active API connection."));
    return RequestHiscores.fetchMemberHiscores({
      baseURL: this.baseURL,
      credentials: this.credentials,
      memberName,
    });
  }
}
