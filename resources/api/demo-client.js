import demoData from "./demo-data.json";
import { memberColorHues } from "../game/member-colors";
import { skills } from "../game/skill";
import { fetchGameData } from "./game-data";
import { EXPERIENCE_99, createInitialState } from "./demo/fixtures";
import { mockGroupDataResponse } from "./demo/group-simulation";
import { populateSkillDataFromRoster } from "./demo/skill-history";
import {
  createBossKillCountSnapshot,
  createCollectionSnapshot,
  createDiarySnapshot,
  createQuestSnapshot,
  createSkillsSnapshot,
  populateSnapshotHistory,
} from "./demo/snapshot-history";

export default class DemoClient {
  baseURL = __API_URL__;
  credentials = {
    name: "Demo Group",
    token: "00000000-0000-0000-0000-000000000000",
  };
  state = createInitialState();
  startMS = performance.now();
  demoData;
  gameData;
  gameDataPromise;

  constructor() {
    this.populateSkillDataFromRoster();
  }

  async fetchGameData() {
    if (!this.gameDataPromise) {
      this.gameDataPromise = this.initialize();
    }

    try {
      return await this.gameDataPromise;
    } catch (reason) {
      this.gameDataPromise = undefined;

      throw reason;
    }
  }

  async initialize() {
    const [gameData] = await Promise.all([
      fetchGameData(this.baseURL),
      new Promise(function waitForDemo(resolve) {
        setTimeout(resolve, 100);
      }),
    ]);

    this.demoData = demoData;
    this.gameData = gameData;

    const TALENTED_PLAYERS = ["Cow31337Killer", "xXgamerXx"];
    const hiscoreCategories = demoData.hiscore_categories;
    for (const member of TALENTED_PLAYERS) {
      this.state.hiscores.set(
        member,
        new Map(hiscoreCategories.map((category) => [category, Math.floor(Math.random() * 100)])),
      );
    }
    const sharedBank = new Map();
    for (const name of TALENTED_PLAYERS) {
      const bank = new Map();
      const collection = new Map();
      for (const [, pages] of this.gameData.collectionLogInfo?.tabs ?? []) {
        for (const { items } of pages) {
          for (const item of items) {
            const totalCount = Math.floor(Math.max(0, (Math.random() - 0.5) * 8));
            collection.set(item, totalCount);
            bank.set(item, {
              itemID: item,
              quantity: totalCount,
            });
          }
        }
      }
      for (const [itemID, { quantity: totalCount }] of bank) {
        const depositedCount = Math.floor(Math.random() * totalCount);
        const keptCount = totalCount - depositedCount;
        if (depositedCount > 0) {
          const existing = sharedBank.get(itemID);
          sharedBank.set(itemID, {
            itemID,
            quantity: (existing?.quantity ?? 0) + depositedCount,
          });
        }
        if (keptCount > 0) {
          bank.set(itemID, {
            itemID,
            quantity: keptCount,
          });
        } else {
          bank.delete(itemID);
        }
      }
      this.state.collections.set(name, collection);
      this.state.banks.set(name, bank);
    }
    for (const skill of skills) {
      this.state.cowKiller.skills[skill] = Math.ceil(EXPERIENCE_99 * Math.random());
    }
    const QUEST_STATUSES = ["IN_PROGRESS", "NOT_STARTED", "FINISHED"];
    for (let i = 0; i < this.state.cowKiller.quests.length; i++) {
      this.state.cowKiller.quests[i] = QUEST_STATUSES[Math.floor(Math.random() * QUEST_STATUSES.length)];
    }
    for (const diaryRegion of Object.values(this.state.cowKiller.diaries)) {
      diaryRegion.Easy = diaryRegion.Easy.map(() => Math.random() < 0.9);
      diaryRegion.Medium = diaryRegion.Medium.map(() => Math.random() < 0.7);
      diaryRegion.Hard = diaryRegion.Hard.map(() => Math.random() < 0.5);
      diaryRegion.Elite = diaryRegion.Elite.map(() => Math.random() < 0.3);
    }
    this.state.sharedBank = sharedBank;
    this.populateSnapshotHistory();

    return gameData;
  }

  async fetchGroupData() {
    await this.fetchGameData();

    return mockGroupDataResponse(this.state, this.startMS, this.demoData);
  }

  populateSnapshotHistory() {
    populateSnapshotHistory(this.state, this.gameData);
  }

  skillsSnapshot(skillExperience, reductions) {
    return createSkillsSnapshot(skillExperience, reductions);
  }

  questSnapshot(statuses, unfinishedQuestCount = 0) {
    return createQuestSnapshot(statuses, this.gameData.quests, unfinishedQuestCount);
  }

  diarySnapshot(diaries, removals) {
    return createDiarySnapshot(diaries, removals);
  }

  collectionSnapshot(collection, reductions) {
    return createCollectionSnapshot(collection, reductions);
  }

  bossKcSnapshot(hiscores, reductions) {
    return createBossKillCountSnapshot(hiscores, reductions);
  }

  populateSkillDataFromRoster() {
    populateSkillDataFromRoster(this.state);
  }
  async fetchSkillData(period) {
    await this.fetchGameData();
    const skillData = structuredClone(this.state.skillData[period]);

    return new Promise(function waitForSkillData(resolve) {
      setTimeout(function resolveSkillData() {
        resolve(skillData);
      }, 700);
    });
  }

  async addGroupMember(member) {
    if (this.state.roster.length >= 5) {
      return {
        status: "error",
        text: "Group is full (5 members).",
      };
    }
    const memberInRoster = this.state.roster.find(({ displayName }) => displayName === member);
    if (memberInRoster) {
      return {
        status: "error",
        text: "A member of that name already exists.",
      };
    }
    const takenHues = new Set(this.state.roster.map(({ colorHueDegrees }) => colorHueDegrees));
    const colorHueDegrees = memberColorHues.find((h) => !takenHues.has(h)) ?? memberColorHues[0];
    this.state.roster.push({
      displayName: member,
      colorHueDegrees,
    });
    this.populateSkillDataFromRoster();
    return {
      status: "ok",
    };
  }

  async renameGroupMember({ oldName, newName }) {
    const oldMember = this.state.roster.find(({ displayName }) => displayName === oldName);
    if (!oldMember) {
      return {
        status: "error",
        text: "No member has that name.",
      };
    }
    const newMember = this.state.roster.find(({ displayName }) => displayName === newName);
    if (newMember) {
      return {
        status: "error",
        text: "A member of that name already exists.",
      };
    }
    oldMember.displayName = newName;
    this.populateSkillDataFromRoster();
    return {
      status: "ok",
    };
  }

  async deleteGroupMember(member) {
    const memberInRoster = this.state.roster.findIndex(({ displayName }) => displayName === member);

    if (memberInRoster === -1) {
      return {
        status: "error",
        text: "No member has that name.",
      };
    }

    this.state.roster = [...this.state.roster.slice(0, memberInRoster), ...this.state.roster.slice(memberInRoster + 1)];
    this.populateSkillDataFromRoster();

    return {
      status: "ok",
    };
  }

  async fetchGroupCollectionLogs() {
    await this.fetchGameData();

    return structuredClone(this.state.collections);
  }

  async fetchMemberSnapshots(markers) {
    await this.fetchGameData();
    const baselines = new Map();
    for (const [member, snapshots] of this.state.snapshots) {
      const lastWeek = snapshots[0];
      if (!lastWeek) continue;
      const marker = markers[member];
      const lastVisit =
        marker === undefined ? lastWeek : (snapshots.findLast((snapshot) => snapshot.timestamp <= marker) ?? lastWeek);
      baselines.set(
        member,
        structuredClone({
          lastVisit,
          lastWeek,
        }),
      );
    }
    return baselines;
  }

  async createMemberSnapshot(member) {
    await this.fetchGameData();
    const currentMember = mockGroupDataResponse(this.state, this.startMS, this.demoData).find(
      ({ name }) => name === member,
    );
    if (!currentMember) {
      throw new Error("No member has that name.");
    }
    if (!currentMember.skills || !currentMember.quests || !currentMember.diaries) {
      throw new Error("Member data is incomplete.");
    }
    const snapshot = {
      timestamp: Date.now(),
      skills: this.skillsSnapshot(currentMember.skills, {}),
      quests: this.questSnapshot(currentMember.quests),
      diaries: this.diarySnapshot(currentMember.diaries, []),
      collection: this.collectionSnapshot(this.state.collections.get(member), {}),
      bossKc: Object.fromEntries(this.state.hiscores.get(member) ?? []),
    };
    const snapshots = this.state.snapshots.get(member) ?? [];
    snapshots.push(snapshot);
    this.state.snapshots.set(member, snapshots);
    return structuredClone(snapshot);
  }

  async fetchMemberHiscores(memberName) {
    await this.fetchGameData();

    return structuredClone(this.state.hiscores.get(memberName) ?? new Map());
  }

  async updateMemberColor({ memberName, colorHueDegrees }) {
    const SHARED_NAME = "@SHARED";
    const member = this.state.roster.find(({ displayName }) => displayName === memberName);
    if (!member) {
      return {
        status: "error",
        text: "Member not found.",
      };
    }
    let swapped;
    const occupant = this.state.roster.find(
      ({ displayName, colorHueDegrees: h }) =>
        h === colorHueDegrees && displayName !== memberName && displayName !== SHARED_NAME,
    );
    if (occupant) {
      const oldMemberHue = member.colorHueDegrees;
      occupant.colorHueDegrees = oldMemberHue;
      swapped = {
        name: occupant.displayName,
        color_hue_degrees: oldMemberHue,
      };
    }
    member.colorHueDegrees = colorHueDegrees;
    return {
      status: "ok",
      updated: {
        name: memberName,
        color_hue_degrees: colorHueDegrees,
      },
      ...(swapped && {
        swapped,
      }),
    };
  }
}
