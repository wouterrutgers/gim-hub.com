import { fetchItemDataJSON, type ItemsDatabase } from "../game/items";
import { fetchQuestDataJSON, type QuestDatabase, type QuestID, type QuestStatus } from "../game/quests";
import { fetchDiaryDataJSON, type DiaryDatabase } from "../game/diaries";
import type * as Member from "../game/member";
import { Vec2D, type WikiPosition2D } from "../components/canvas-map/coordinates";
import type { CollectionLogInfo } from "../game/collection-log";
import { type GEPrices } from "./requests/ge-prices";
import { Schema as GetGroupDataResponseSchema, type Response as GetGroupDataResponse } from "./requests/group-data";
import * as RequestSkillData from "./requests/skill-data";
import * as RequestCreateGroup from "./requests/create-group";
import * as RequestAddGroupMember from "./requests/add-group-member";
import * as RequestDeleteGroupMember from "./requests/delete-group-member";
import * as RequestRenameGroupMember from "./requests/rename-group-member";
import MockData from "./demo-api-data.json" with { type: "json" };
import type { GroupCredentials } from "./credentials";

export type GroupStateUpdate = Map<Member.Name, Partial<Member.State>>;

export interface GameData {
  items?: ItemsDatabase;
  quests?: QuestDatabase;
  diaries?: DiaryDatabase;
  gePrices?: GEPrices;
  collectionLogInfo?: CollectionLogInfo;
}

const mockGroupDataResponse = (): Promise<GetGroupDataResponse> => {
  const mockResponse = GetGroupDataResponseSchema.parse(MockData);
  return Promise.resolve(mockResponse);
};

interface UpdateCallbacks {
  onGroupUpdate: (group: GroupStateUpdate) => void;
  onGameDataUpdate: (data: GameData) => void;
}
export default class DemoApi {
  private closed: boolean;

  private getGroupDataPromise: Promise<void> | undefined;
  private callbacks: Partial<UpdateCallbacks> = {};

  private gameData: GameData = {};

  public isOpen(): boolean {
    return !this.closed;
  }

  private updateGroupData(response: GetGroupDataResponse): void {
    const updates: GroupStateUpdate = new Map();

    for (const { name, coordinates, quests, ...rest } of response) {
      const update: Partial<Member.State> = { ...rest };

      if (coordinates) {
        update.coordinates = {
          coords: Vec2D.create<WikiPosition2D>({
            x: coordinates.x,
            y: coordinates.y,
          }),
          plane: coordinates.plane,
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

    this.callbacks?.onGroupUpdate?.(updates);
  }

  public getCredentials(): GroupCredentials {
    return { name: "Demo Group", token: "00000000-0000-0000-0000-000000000000" };
  }

  public overwriteSomeUpdateCallbacks(callbacks: Partial<UpdateCallbacks>): void {
    Object.assign(this.callbacks, callbacks);

    // Invoke the callback, so they can get the current state if they missed the
    // update.

    if (callbacks.onGameDataUpdate) {
      this.callbacks.onGameDataUpdate?.(this.gameData);
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
    if (!this.gameData.diaries) {
      fetchDiaryDataJSON()
        .then((data) => {
          this.gameData.diaries = data;
          this.callbacks?.onGameDataUpdate?.(this.gameData);
        })
        .catch((reason) => console.error("Failed to get diary data for API", reason));
    }
    if (!this.gameData.gePrices) {
      // TODO: maybe implement this
    }
    if (!this.gameData.collectionLogInfo) {
      // TODO: maybe implement this
    }
  }

  private queueFetchGroupData(): void {
    const FETCH_INTERVAL_MS = 1000;

    this.getGroupDataPromise ??= mockGroupDataResponse()
      .then((response) => {
        this.updateGroupData(response);
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

    this.gameData = {};
  }

  constructor() {
    this.closed = false;

    this.queueGetGameData();
    this.queueFetchGroupData();
  }

  static async fetchAmILoggedIn(): Promise<Response> {
    return Promise.reject(new Error("Not implemented."));
  }
  static async fetchCreateGroup(): Promise<RequestCreateGroup.Response> {
    return Promise.reject(new Error("Not implemented."));
  }

  async fetchSkillData(): Promise<RequestSkillData.Response> {
    return Promise.reject(new Error("Not implemented."));
  }

  async addGroupMember(): Promise<RequestAddGroupMember.Response> {
    return Promise.reject(new Error("Not implemented."));
  }
  async renameGroupMember(): Promise<RequestRenameGroupMember.Response> {
    return Promise.reject(new Error("Not implemented."));
  }
  async deleteGroupMember(): Promise<RequestDeleteGroupMember.Response> {
    return Promise.reject(new Error("Not implemented."));
  }
  async fetchGroupCollectionLogs(): Promise<void> {
    return Promise.reject(new Error("Not implemented."));
  }
}
