import demoData from "./demo-data.json";
import { memberColorHues } from "../game/member-colors";
import { skills } from "../game/skill";
import { fetchGameData } from "./game-data";
import { EXPERIENCE_99, createInitialState } from "./demo/fixtures";
import { mockGroupDataResponse } from "./demo/group-simulation";
import { getDemoSkillHistory, populateSkillDataFromRoster } from "./demo/skill-history";
import { populateActivity, advanceActivity } from "./demo/activity";

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
    populateSkillDataFromRoster(this.state);
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
    populateActivity(this.state);

    return gameData;
  }

  async fetchGroupData() {
    await this.fetchGameData();

    const members = mockGroupDataResponse(this.state, this.startMS, this.demoData);
    advanceActivity(this.state, members);
    return members;
  }

  async fetchSkillData(range) {
    return getDemoSkillHistory(this.state, range);
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
      id: this.state.nextMemberIdentifier++,
      displayName: member,
      colorHueDegrees,
    });
    populateSkillDataFromRoster(this.state);
    return {
      status: "ok",
    };
  }

  async reorderGroupMembers(memberNames) {
    this.state.roster.sort(function sortMembers(left, right) {
      return memberNames.indexOf(left.displayName) - memberNames.indexOf(right.displayName);
    });

    return { status: "ok" };
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
    populateSkillDataFromRoster(this.state);
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

    const memberIdentifier = this.state.roster[memberInRoster].id;
    this.state.roster = [...this.state.roster.slice(0, memberInRoster), ...this.state.roster.slice(memberInRoster + 1)];
    for (const [identifier, entry] of this.state.activities) {
      if (entry.member_id === memberIdentifier) this.state.activities.delete(identifier);
    }
    this.state.activitySkills.delete(memberIdentifier);
    populateSkillDataFromRoster(this.state);

    return {
      status: "ok",
    };
  }

  async fetchGroupCollectionLogs() {
    await this.fetchGameData();

    return structuredClone(this.state.collections);
  }

  async fetchActivity({ fromTime, cursor } = {}) {
    await this.fetchGameData();
    const entries = [...this.state.activities.values()].sort(function newest(left, right) {
      return right.started_at - left.started_at || right.id - left.id;
    });
    const filtered = fromTime
      ? entries.filter(function changed(entry) {
          return entry.updated_at >= new Date(fromTime).getTime();
        })
      : entries.slice(Number(cursor ?? 0), Number(cursor ?? 0) + 50);
    return structuredClone({
      entries: filtered,
      older_cursor: !fromTime && entries.length > Number(cursor ?? 0) + 50 ? String(Number(cursor ?? 0) + 50) : null,
      from_time: new Date().toISOString(),
    });
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
