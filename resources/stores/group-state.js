import { itemContainerNames, itemContainers } from "../game/member";
import { skills } from "../game/skill";
import { memberColorHues } from "../game/member-colors";
import { Vec2D } from "../components/canvas-map/coordinates";

const SHARED_MEMBER_NAME = "@SHARED";
const EXPERIENCE_DROP_ANIMATION_MILLISECONDS = 9600;

function setsAreEqual(left, right) {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

function mapsAreEqual(left, right) {
  if (left.size !== right.size) {
    return false;
  }

  for (const [key, value] of left) {
    if (right.get(key) !== value) {
      return false;
    }
  }

  return true;
}

function getUpdatedMemberNames(oldState, update, partial) {
  const names = partial ? [...oldState.memberNames, ...update.keys()] : [...update.keys()];

  return new Set(
    names.sort(function sortMemberNames(left, right) {
      return left.localeCompare(right);
    }),
  );
}

function createMemberColors(oldState, memberNames, colorUpdates, partial) {
  if (!setsAreEqual(oldState.memberNames, memberNames)) {
    const memberColors = new Map();

    for (const name of memberNames) {
      if (name === SHARED_MEMBER_NAME) {
        memberColors.set(name, { hueDegrees: 0 });
        continue;
      }

      const serverHue = colorUpdates.get(name);
      const existingColor = oldState.memberColors.get(name);

      if (serverHue !== undefined) {
        memberColors.set(name, { hueDegrees: serverHue });
      } else if (existingColor) {
        memberColors.set(name, existingColor);
      }
    }

    const takenHues = new Set(
      [...memberColors.values()].map(function getHue({ hueDegrees }) {
        return hueDegrees;
      }),
    );

    for (const name of memberNames) {
      if (memberColors.has(name)) {
        continue;
      }

      const hueDegrees =
        memberColorHues.find(function hueIsAvailable(hue) {
          return !takenHues.has(hue);
        }) ?? 0;

      memberColors.set(name, { hueDegrees });
      takenHues.add(hueDegrees);
    }

    return memberColors;
  }

  if (partial || colorUpdates.size === 0) {
    return oldState.memberColors;
  }

  const memberColors = new Map(oldState.memberColors);

  for (const [name, hueDegrees] of colorUpdates) {
    const existingColor = memberColors.get(name);

    if (existingColor && existingColor.hueDegrees !== hueDegrees) {
      memberColors.set(name, { hueDegrees });
    }
  }

  return mapsAreEqual(oldState.memberColors, memberColors) ? oldState.memberColors : memberColors;
}

function createEmptyItemContainers() {
  return Object.fromEntries(
    itemContainers.map(function createEmptyContainer({ key }) {
      return [key, new Map()];
    }),
  );
}

function createMemberStates(oldState, memberNames, update) {
  const memberStates = new Map();
  let changed = !setsAreEqual(oldState.memberNames, memberNames);

  for (const memberName of memberNames) {
    const stateUpdate = update.get(memberName);
    const oldMemberState = oldState.memberStates.get(memberName);

    if (stateUpdate || !oldMemberState) {
      memberStates.set(memberName, {
        lastUpdated: new Date(0),
        ...createEmptyItemContainers(),
        ...oldMemberState,
        ...stateUpdate,
      });
      changed = true;
    } else {
      memberStates.set(memberName, oldMemberState);
    }
  }

  return changed ? memberStates : oldState.memberStates;
}

function createCollections(oldState, memberStates) {
  const collections = new Map();
  let changed = false;

  for (const [name, { collection }] of memberStates) {
    if (!collection) {
      continue;
    }

    const oldCollection = oldState.collections.get(name);

    if (oldCollection && mapsAreEqual(oldCollection, collection)) {
      collections.set(name, oldCollection);
    } else {
      collections.set(name, collection);
      changed = true;
    }
  }

  if (oldState.collections.size !== collections.size) {
    changed = true;
  }

  return changed ? collections : oldState.collections;
}

function itemBreakdownsAreEqual(left, right) {
  if (left.size !== right.size) {
    return false;
  }

  for (const [memberName, memberBreakdown] of left) {
    const otherMemberBreakdown = right.get(memberName);

    if (!otherMemberBreakdown) {
      return false;
    }

    for (const containerName of itemContainerNames) {
      if (memberBreakdown[containerName] !== otherMemberBreakdown[containerName]) {
        return false;
      }
    }
  }

  return true;
}

function createItems(oldState, memberStates) {
  const items = new Map();

  function addContainerQuantity(containerName, memberName, { itemID, quantity }) {
    if (!items.has(itemID)) {
      items.set(itemID, new Map());
    }

    const itemView = items.get(itemID);

    if (!itemView.has(memberName)) {
      itemView.set(memberName, {});
    }

    const memberBreakdown = itemView.get(memberName);
    memberBreakdown[containerName] = (memberBreakdown[containerName] ?? 0) + quantity;
  }

  for (const [memberName, memberState] of memberStates) {
    for (const { name: containerName, key, getItems } of itemContainers) {
      const container = memberState[key];

      if (!container) {
        continue;
      }

      for (const item of getItems(container)) {
        addContainerQuantity(containerName, memberName, item);
      }
    }
  }

  let changed = oldState.items.size !== items.size;

  for (const [itemIdentifier, itemBreakdown] of items) {
    const oldItemBreakdown = oldState.items.get(itemIdentifier);

    if (oldItemBreakdown && itemBreakdownsAreEqual(oldItemBreakdown, itemBreakdown)) {
      items.set(itemIdentifier, oldItemBreakdown);
    } else {
      changed = true;
    }
  }

  return changed ? items : oldState.items;
}

function createExperienceDrops(oldState, memberStates) {
  const experienceDrops = new Map(oldState.xpDrops);
  let experienceDropCounter = oldState.xpDropCounter;
  let changed = false;

  for (const [memberName, { skills: newSkills }] of memberStates) {
    const oldSkills = oldState.memberStates.get(memberName)?.skills;

    if (!oldSkills || !newSkills) {
      continue;
    }

    const amounts = [];

    for (const skill of skills) {
      const amount = newSkills[skill] - oldSkills[skill];

      if (amount > 0) {
        amounts.push({ skill, amount });
      }
    }

    if (amounts.length === 0) {
      continue;
    }

    const existingDrops = experienceDrops.get(memberName) ?? [];
    experienceDrops.set(memberName, [
      ...existingDrops,
      {
        id: experienceDropCounter,
        amounts,
        creationTimeMS: performance.now(),
      },
    ]);
    experienceDropCounter += 1;
    changed = true;
  }

  if (!changed) {
    return { experienceDrops: oldState.xpDrops, experienceDropCounter: oldState.xpDropCounter };
  }

  const nowMilliseconds = performance.now();

  for (const [memberName, drops] of experienceDrops) {
    experienceDrops.set(
      memberName,
      drops.filter(function isAnimating(drop) {
        return nowMilliseconds - drop.creationTimeMS < EXPERIENCE_DROP_ANIMATION_MILLISECONDS;
      }),
    );
  }

  return { experienceDrops, experienceDropCounter };
}

export function createGroupState() {
  return {
    items: new Map(),
    memberStates: new Map(),
    memberNames: new Set(),
    memberColors: new Map(),
    collections: new Map(),
    xpDropCounter: 0,
    xpDrops: new Map(),
  };
}

export function updateGroupState(state, update, { partial = false, colorUpdates = new Map() } = {}) {
  const memberNames = getUpdatedMemberNames(state, update, partial);
  const memberNamesChanged = !setsAreEqual(state.memberNames, memberNames);
  const memberColors = createMemberColors(state, memberNames, colorUpdates, partial);
  const memberStates = createMemberStates(state, memberNames, update);
  const collections = memberStates === state.memberStates ? state.collections : createCollections(state, memberStates);
  const items = memberStates === state.memberStates ? state.items : createItems(state, memberStates);
  const { experienceDrops, experienceDropCounter } =
    memberStates === state.memberStates
      ? { experienceDrops: state.xpDrops, experienceDropCounter: state.xpDropCounter }
      : createExperienceDrops(state, memberStates);

  if (
    !memberNamesChanged &&
    memberColors === state.memberColors &&
    memberStates === state.memberStates &&
    collections === state.collections &&
    items === state.items &&
    experienceDrops === state.xpDrops
  ) {
    return state;
  }

  return {
    items,
    memberStates,
    memberNames: memberNamesChanged ? memberNames : state.memberNames,
    memberColors,
    collections,
    xpDropCounter: experienceDropCounter,
    xpDrops: experienceDrops,
  };
}

export function updateGroupMemberColors(state, updates) {
  const memberColors = new Map(state.memberColors);

  for (const { name, hueDegrees } of updates) {
    const existingColor = memberColors.get(name);

    if (existingColor && existingColor.hueDegrees !== hueDegrees) {
      memberColors.set(name, { hueDegrees });
    }
  }

  if (mapsAreEqual(state.memberColors, memberColors)) {
    return state;
  }

  return { ...state, memberColors };
}

export function mapGroupResponse(response, quests) {
  const updates = new Map();
  const colorUpdates = new Map();
  let newestTimestamp = new Date(0);

  for (const { name, coordinates, quests: questStatuses, colorHueDegrees, ...fields } of response) {
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) {
        delete fields[key];
      }
    }

    if (coordinates) {
      fields.coordinates = {
        coords: Vec2D.create(coordinates),
        plane: coordinates.plane,
        isOnBoat: coordinates.isOnBoat,
      };
    }

    if (questStatuses && quests) {
      fields.quests = new Map();
      let questIndex = 0;

      for (const questIdentifier of quests.keys()) {
        fields.quests.set(questIdentifier, questStatuses.at(questIndex) ?? "NOT_STARTED");
        questIndex += 1;
      }
    }

    if (colorHueDegrees !== undefined) {
      colorUpdates.set(name, colorHueDegrees);
    }

    if (fields.lastUpdated && fields.lastUpdated > newestTimestamp) {
      newestTimestamp = fields.lastUpdated;
    }

    updates.set(name, fields);
  }

  return { updates, colorUpdates, newestTimestamp };
}
