import { fetchItemDataJSON, type ItemID, type ItemsDatabase, type ItemStack } from "../game/items";
import { fetchQuestDataJSON, type QuestDatabase, type QuestID, type QuestStatus } from "../game/quests";
import { fetchDiaryDataJSON, type DiaryDatabase } from "../game/diaries";
import type * as Member from "../game/member";
import { Vec2D, type WikiPosition2D } from "../components/canvas-map/coordinates";
import { type CollectionLogInfo } from "../game/collection-log";
import { fetchGEPrices, type GEPrices } from "./requests/ge-prices";
import { Schema as GetGroupDataResponseSchema, type Response as GetGroupDataResponse } from "./requests/group-data";
import * as RequestSkillData from "./requests/skill-data";
import * as RequestCreateGroup from "./requests/create-group";
import * as RequestAddGroupMember from "./requests/add-group-member";
import * as RequestDeleteGroupMember from "./requests/delete-group-member";
import * as RequestRenameGroupMember from "./requests/rename-group-member";
import * as RequestHiscores from "./requests/hiscores";
import type { GroupCredentials } from "./credentials";
import { Skill, type Experience } from "../game/skill";
import { EquipmentSlot } from "../game/equipment";
import { fetchCollectionLogInfo } from "./requests/collection-log-info";

export type GroupStateUpdate = Map<Member.Name, Partial<Member.State>>;

export interface GameData {
  items?: ItemsDatabase;
  quests?: QuestDatabase;
  diaries?: DiaryDatabase;
  gePrices?: GEPrices;
  collectionLogInfo?: CollectionLogInfo;
}

const EXPERIENCE_99 = 13034431 as Experience;
const EXPERIENCE_90 = 5346332 as Experience;
const EXPERIENCE_70 = 737627 as Experience;
const DEFAULT_MEMBER = GetGroupDataResponseSchema.parse([{ name: "" }])[0];
const DEFAULT_SKILLS = {
  Agility: 0 as Experience,
  Attack: 0 as Experience,
  Construction: 0 as Experience,
  Cooking: 0 as Experience,
  Crafting: 0 as Experience,
  Defence: 0 as Experience,
  Farming: 0 as Experience,
  Firemaking: 0 as Experience,
  Fishing: 0 as Experience,
  Fletching: 0 as Experience,
  Herblore: 0 as Experience,
  Hitpoints: 1154 as Experience,
  Hunter: 0 as Experience,
  Magic: 0 as Experience,
  Mining: 0 as Experience,
  Prayer: 0 as Experience,
  Ranged: 0 as Experience,
  Runecraft: 0 as Experience,
  Slayer: 0 as Experience,
  Smithing: 0 as Experience,
  Strength: 0 as Experience,
  Thieving: 0 as Experience,
  Woodcutting: 0 as Experience,
};
const MAX_QUEST = GetGroupDataResponseSchema.parse([{ name: "", quests: new Array(400).fill(2) }])[0].quests;
const MAX_DIARY_TIER = {
  Easy: new Array(20).fill(true),
  Medium: new Array(20).fill(true),
  Hard: new Array(20).fill(true),
  Elite: new Array(20).fill(true),
};
const MAX_DIARY = {
  "Kourend & Kebos": MAX_DIARY_TIER,
  "Lumbridge & Draynor": MAX_DIARY_TIER,
  "Western Provinces": MAX_DIARY_TIER,
  Ardougne: MAX_DIARY_TIER,
  Desert: MAX_DIARY_TIER,
  Falador: MAX_DIARY_TIER,
  Fremennik: MAX_DIARY_TIER,
  Kandarin: MAX_DIARY_TIER,
  Karamja: MAX_DIARY_TIER,
  Morytania: MAX_DIARY_TIER,
  Varrock: MAX_DIARY_TIER,
  Wilderness: MAX_DIARY_TIER,
} satisfies Member.Diaries;

const mockGroupDataResponse = (
  { thurgo, cowKiller }: DemoGroup,
  startMS: number,
  demoData: typeof import("./demo-api-data.json"),
): Promise<GetGroupDataResponse> => {
  const results: GetGroupDataResponse = [];

  startMS ??= performance.now();
  const elapsedMS = performance.now() - startMS;

  {
    // Thurgo cooks pies in the myth's guild
    const member = {
      ...DEFAULT_MEMBER,
      name: "Thurgo" as Member.Name,
      stats: {
        health: { current: 99, max: 99 },
        prayer: { current: 1, max: 1 },
        run: { current: 100, max: 100 },
        world: 201,
      },
      coordinates: { x: 2465, y: 2848, plane: 1 },
    } satisfies GetGroupDataResponse[number];
    member.lastUpdated = new Date(Date.now());

    while (thurgo.lastTick < Math.floor(elapsedMS / 600)) {
      const banking = thurgo.bankingCooldown > 0;
      if (banking) {
        thurgo.bankingCooldown -= 1;
        if (thurgo.bankingCooldown <= 4) {
          thurgo.piesCookedInBank += thurgo.piesCookedInInventory;
          thurgo.piesUncookedInBank += thurgo.piesUncookedInInventory;
          thurgo.piesCookedInInventory = 0;
          thurgo.piesUncookedInInventory = 0;
        }

        if (thurgo.bankingCooldown <= 0) {
          thurgo.piesUncookedInBank -= 28;
          thurgo.piesUncookedInInventory = 28;
          thurgo.bankingCooldown = 0;
        }
      } else {
        thurgo.piesCookedInInventory += 1;
        thurgo.piesUncookedInInventory -= 1;
        if (thurgo.piesCookedInInventory >= 28) {
          thurgo.piesCookedInInventory = 28;
          thurgo.piesUncookedInInventory = 0;
          thurgo.bankingCooldown = 8;
        }
      }
      thurgo.lastTick += 1;
    }

    const REDBERRY_PIE_COOKED = 2325 as ItemID;
    const REDBERRY_PIE_UNCOOKED = 2321 as ItemID;

    member.bank = new Map([
      [REDBERRY_PIE_UNCOOKED, thurgo.piesUncookedInBank],
      [REDBERRY_PIE_COOKED, thurgo.piesCookedInBank],
    ]);
    member.skills = {
      ...DEFAULT_SKILLS,
      Cooking: (61512 + (thurgo.piesCookedInBank + thurgo.piesCookedInInventory) * 78) as Experience,
    };
    member.inventory = [];
    for (let i = 0; i < thurgo.piesCookedInInventory; i++) {
      member.inventory.push({ itemID: REDBERRY_PIE_COOKED, quantity: 1 });
    }
    for (let i = 0; i < thurgo.piesUncookedInInventory; i++) {
      member.inventory.push({ itemID: REDBERRY_PIE_UNCOOKED, quantity: 1 });
    }

    results.push(member);
  }
  {
    // Cow31337Killer kills undead cows
    const member = {
      ...DEFAULT_MEMBER,
      name: "Cow31337Killer" as Member.Name,
      skills: { ...DEFAULT_SKILLS },
      stats: {
        health: { current: 90, max: 90 },
        prayer: { current: 80, max: 80 },
        run: { current: 100, max: 100 },
        world: 201,
      },
      coordinates: { x: 3616, y: 3525, plane: 0 },
      lastUpdated: new Date(Date.now()),
    } satisfies GetGroupDataResponse[number];

    while (cowKiller.lastTick < elapsedMS / 600) {
      cowKiller.attackCooldown -= 1;
      if (cowKiller.attackCooldown <= 0) {
        const damage = Math.max(Math.min(cowKiller.cowHP, Math.floor(Math.random() * (cowKiller.MAX_HIT + 1))), 1);
        cowKiller.cowHP -= damage;
        cowKiller.damageDone += damage;
        if (cowKiller.cowHP <= 0) {
          cowKiller.deathCooldown = 5;
        }
        cowKiller.attackCooldown = 7;
      }

      cowKiller.deathCooldown -= 1;
      if (cowKiller.deathCooldown == 0) {
        cowKiller.cowHP = cowKiller.COW_MAX_HP;
      }
      cowKiller.deathCooldown = Math.max(0, cowKiller.deathCooldown);

      cowKiller.lastTick += 1;
    }

    for (const skill of Skill) {
      member.skills[skill] = EXPERIENCE_70;
    }
    member.skills = {
      ...member.skills,
      Attack: EXPERIENCE_99,
      Defence: EXPERIENCE_99,
      Magic: 0 as Experience,
      Ranged: 0 as Experience,
      Strength: (EXPERIENCE_99 + 4 * cowKiller.damageDone) as Experience,
      Hitpoints: Math.floor(EXPERIENCE_90 + (4 / 3) * cowKiller.damageDone) as Experience,
    };

    member.interacting = {
      name: "Undead Cow",
      healthRatio: cowKiller.cowHP / cowKiller.COW_MAX_HP,
      location: { x: 3617, y: 3525, plane: 1 },
      lastUpdated: new Date(Date.now()),
    };
    results.push(member);
  }
  {
    // Gary walks Lumbridge to Varrock, but dies to a Dark wizard at the end
    const member = {
      ...DEFAULT_MEMBER,
      name: "Gary" as Member.Name,
      stats: {
        health: { current: 10, max: 10 },
        prayer: { current: 1, max: 1 },
        run: { current: 100, max: 100 },
        world: 201,
      },
      lastUpdated: new Date(Date.now()),
      equipment: new Map([
        ["Weapon", { itemID: 1265 as ItemID, quantity: 1 }], // bronze pickaxe
        ["Shield", { itemID: 1171 as ItemID, quantity: 1 }], // wooden shield
      ]),
      interacting: {
        name: "Dark wizard",
        healthRatio: 1.0,
        lastUpdated: new Date(0),
        location: { x: 3223, y: 3363, plane: 0 },
      },
    } satisfies GetGroupDataResponse[number];

    const timeline: number[][] = demoData.gary_timeline;
    const index = Math.max(Math.floor(elapsedMS / 600), 0) % timeline.length;
    const WIZARD_ENCOUNTER_TICK = timeline.length - 28;
    const WIZARD_DAMAGE_TICK = timeline.length - 26;
    if (index > WIZARD_ENCOUNTER_TICK) {
      member.interacting.lastUpdated = new Date(Date.now());
    }
    if (index > WIZARD_DAMAGE_TICK) {
      member.stats.health.current = Math.max(0, 10 - Math.floor((index - WIZARD_DAMAGE_TICK) / 4) * 2);
    }

    const [x, y] = timeline.at(index) ?? [0, 0];
    member.coordinates = { x, y, plane: 0 };

    results.push(member);
  }
  {
    // Duradel stands in Shilo Village
    const member = {
      ...DEFAULT_MEMBER,
      name: "Duradel" as Member.Name,
      stats: {
        health: { current: 99, max: 99 },
        prayer: { current: 99, max: 99 },
        run: { current: 100, max: 100 },
        world: 201,
      },
      coordinates: { x: 2868, y: 2982, plane: 1 },
      lastUpdated: new Date(Date.now()),
      equipment: new Map([
        ["Weapon", { itemID: 3101 as ItemID, quantity: 1 }], // Rune claws
        ["Cape", { itemID: 9786 as ItemID, quantity: 1 }], // Slayer cape
      ]),
    } satisfies GetGroupDataResponse[number];

    results.push(member);
  }
  {
    // xXgamerXx bankstands ToA lobby in BiS
    const member = {
      ...DEFAULT_MEMBER,
      name: "xXgamerXx" as Member.Name,
      lastUpdated: new Date(Date.now()),
      skills: { ...DEFAULT_SKILLS },
      stats: {
        health: { current: 99, max: 99 },
        prayer: { current: 99, max: 99 },
        run: { current: 100, max: 100 },
        world: 329,
      },
      quests: MAX_QUEST,
      diaries: MAX_DIARY,
      coordinates: { x: 3354, y: 9120, plane: 0 },
      quiver: new Map([[11212 as ItemID, 24381]]), // dragon arrow
      equipment: new Map<EquipmentSlot, ItemStack>([
        ["Cape", { itemID: 28955 as ItemID, quantity: 1 }], // quiver
        ["Head", { itemID: 27235 as ItemID, quantity: 1 }], // masori
        ["Body", { itemID: 27238 as ItemID, quantity: 1 }], // masori
        ["Legs", { itemID: 27241 as ItemID, quantity: 1 }], // masori
        ["Amulet", { itemID: 19547 as ItemID, quantity: 1 }], // anguish
        ["Weapon", { itemID: 20997 as ItemID, quantity: 1 }], // tbow
        ["Ammo", { itemID: 27544 as ItemID, quantity: 1 }], // penny
        ["Boots", { itemID: 31097 as ItemID, quantity: 1 }], // avernic
        ["Gloves", { itemID: 26235 as ItemID, quantity: 1 }], // zaryte
        ["Ring", { itemID: 28310 as ItemID, quantity: 1 }], // venator ring
      ]),
      inventory: [
        { itemID: 27275 as ItemID, quantity: 1 }, // shadow
        { itemID: 24664 as ItemID, quantity: 1 }, // ancestral hat
        { itemID: 27246 as ItemID, quantity: 1 }, // fang
        { itemID: 28254 as ItemID, quantity: 1 }, // torva helm
        { itemID: 12002 as ItemID, quantity: 1 }, // occult
        { itemID: 24666 as ItemID, quantity: 1 }, // ancestral robe
        { itemID: 29804 as ItemID, quantity: 1 }, // rancour
        { itemID: 28256 as ItemID, quantity: 1 }, // torva body
        { itemID: 31106 as ItemID, quantity: 1 }, // confliction
        { itemID: 24668 as ItemID, quantity: 1 }, // ancestral robe bottom
        { itemID: 22981 as ItemID, quantity: 1 }, // ferocious
        { itemID: 28258 as ItemID, quantity: 1 }, // torva legs
        { itemID: 28313 as ItemID, quantity: 1 }, // magus
        { itemID: 21795 as ItemID, quantity: 1 }, // zamorak cape
        { itemID: 28307 as ItemID, quantity: 1 }, // ultor
        { itemID: 21297 as ItemID, quantity: 1 }, // infernal cape
        { itemID: 27291 as ItemID, quantity: 1 }, // sun partisan
        { itemID: 28688 as ItemID, quantity: 1 }, // bp
        { itemID: 27610 as ItemID, quantity: 1 }, // venator bow
        { itemID: 22322 as ItemID, quantity: 1 }, // avernic defender
        { itemID: 8872 as ItemID, quantity: 1 }, // bone dagger
        { itemID: 10925 as ItemID, quantity: 1 }, // sanfew
        { itemID: 10925 as ItemID, quantity: 1 }, // sanfew
        { itemID: 27281 as ItemID, quantity: 1 }, // rune pouch
        { itemID: 10925 as ItemID, quantity: 1 }, // sanfew
        { itemID: 10925 as ItemID, quantity: 1 }, // sanfew
        { itemID: 23685 as ItemID, quantity: 1 }, // supercombat
        { itemID: 25818 as ItemID, quantity: 1 }, // book of the dead
      ],
    } satisfies GetGroupDataResponse[number];

    for (const skill of Skill) {
      member.skills[skill] = EXPERIENCE_99;
    }

    results.push(member);
  }

  return Promise.resolve(results);
};

interface UpdateCallbacks {
  onGroupUpdate: (group: GroupStateUpdate) => void;
  onGameDataUpdate: (data: GameData) => void;
}
interface DemoGroup {
  thurgo: {
    lastTick: number;
    piesCookedInInventory: number;
    piesUncookedInInventory: number;
    piesCookedInBank: number;
    piesUncookedInBank: number;
    bankingCooldown: number;
  };
  cowKiller: {
    MAX_HIT: number;
    COW_MAX_HP: number;
    cowHP: number;
    kills: number;
    damageDone: number;
    lastTick: number;
    deathCooldown: number;
    attackCooldown: number;
  };
  hiscores: Map<Member.Name, RequestHiscores.Response>;
}

const INITIAL_STATE = {
  thurgo: {
    lastTick: 0,
    piesCookedInInventory: 0,
    piesUncookedInInventory: 28,
    piesCookedInBank: 0,
    piesUncookedInBank: 423425,
    bankingCooldown: 0,
  },
  cowKiller: {
    MAX_HIT: 28,
    COW_MAX_HP: 8,
    cowHP: 8,
    kills: 0,
    damageDone: 0,
    lastTick: 0,
    deathCooldown: 0,
    attackCooldown: 3,
  },
  hiscores: new Map(),
};
export default class DemoApi {
  private readonly baseURL: string = __API_URL__;
  private closed: boolean;

  private getGroupDataPromise: Promise<void> | undefined;
  private callbacks: Partial<UpdateCallbacks> = {};

  private gameData: GameData = {};
  private startMS: number;
  private state: DemoGroup = structuredClone(INITIAL_STATE);
  private demoData: typeof import("./demo-api-data.json") | undefined;
  private demoDataPromise: Promise<void> | undefined;

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

  private queueGetGameData(): Promise<GameData> {
    const gameData: GameData = {};
    const promises = [
      fetchQuestDataJSON().then((data) => {
        gameData.quests = data;
        this.callbacks?.onGameDataUpdate?.(gameData);
      }),
      fetchItemDataJSON().then((data) => {
        gameData.items = data;
        this.callbacks?.onGameDataUpdate?.(gameData);
      }),
      fetchDiaryDataJSON().then((data) => {
        gameData.diaries = data;
        this.callbacks?.onGameDataUpdate?.(gameData);
      }),
      fetchGEPrices({ baseURL: this.baseURL }).then((data) => {
        gameData.gePrices = data;
        this.callbacks?.onGameDataUpdate?.(gameData);
      }),
      fetchCollectionLogInfo({ baseURL: this.baseURL }).then((response) => {
        gameData.collectionLogInfo = response;
        this.callbacks?.onGameDataUpdate?.(gameData);
      }),
    ];

    return Promise.allSettled(promises).then((results) => {
      const failures = results.filter((value) => value.status === "rejected");
      if (failures.length > 0) {
        console.error("Failed one or more gameData fetches:", ...failures);
      }

      return gameData;
    });
  }

  private queueFetchGroupData(): void {
    const FETCH_INTERVAL_MS = 1000;

    this.getGroupDataPromise ??= mockGroupDataResponse(this.state, this.startMS, this.demoData!)
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
    this.startMS = performance.now();

    this.demoDataPromise = Promise.all([
      import("./demo-api-data.json"),
      this.queueGetGameData(),
      new Promise<void>((resolve) => {
        // Hacky delay to avoid race with redirecting to demo page causing the first group update to be missed
        setTimeout(() => resolve(), 100);
      }),
    ])
      .then(([demoData, gameData]) => {
        this.demoData = demoData;
        this.gameData = gameData;

        // Load from a manually updated list of categories, since we don't
        // enumerate all categories anywhere and otherwise we'd need to fetch
        // and parse live hiscores data.
        const hiscoreCategories = demoData.hiscore_categories;
        for (const member of ["Cow31337Killer", "Duradel", "Gary", "Thurgo", "xXgamerXx"] as Member.Name[]) {
          this.state.hiscores.set(
            member,
            new Map(hiscoreCategories.map((category) => [category, Math.floor(Math.random() * 100)])),
          );
        }

        this.queueFetchGroupData();
      })
      .catch((reason) => {
        console.error("Failed to initiate Demo API:", reason);
        this.closed = true;
      })
      .finally(() => {
        this.demoDataPromise = undefined;
      });
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
    return Promise.resolve();
  }
  async fetchMemberHiscores(memberName: Member.Name): Promise<RequestHiscores.Response> {
    await this.demoDataPromise;
    return Promise.resolve(this.state.hiscores.get(memberName) ?? new Map<string, number>());
  }
}
