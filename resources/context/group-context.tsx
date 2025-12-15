import { createContext, type ReactNode, useContext, useEffect, useReducer } from "react";
import * as Member from "../game/member";
import { Context as APIContext } from "./api-context";
import { type ItemID, type ItemStack } from "../game/items";
import type { GroupStateUpdate } from "../api/api";
import { type Experience, Skill } from "../game/skill";

interface MemberColor {
  hueDegrees: number;
}

interface GroupState {
  items: Map<ItemID, Map<Member.Name, Member.ItemLocationBreakdown>>;
  memberStates: Map<Member.Name, Member.State>;
  memberNames: Set<Member.Name>;
  memberColors: Map<Member.Name, MemberColor>;
  collections: Map<Member.Name, Member.Collection>;
  xpDropCounter: number;
  xpDrops: Map<Member.Name, Member.ExperienceDrop[]>;
}

/* eslint-disable react-refresh/only-export-components */

/**
 * Contains all items held by the group, indexed by ItemID then member name.
 */
export const GroupItemsContext = createContext<GroupState["items"]>(new Map());

/**
 * Contains all the current states of each member of the group, such as their
 * stats and inventories.
 */
export const GroupMemberStatesContext = createContext<GroupState["memberStates"]>(new Map());

/**
 * Contains all names of members known. Useful for minimal rerenders since this
 * updates rarely.
 */
export const GroupMemberNamesContext = createContext<GroupState["memberNames"]>(new Set());

/**
 * Contains all the xp drops of the group.
 */
export const GroupXPDropsContext = createContext<GroupState["xpDrops"]>(new Map());

/**
 * Contains the colors of the group. These colors are not stable if the group changes.
 */
export const GroupMemberColorsContext = createContext<GroupState["memberColors"]>(new Map());

/**
 * Contains the collection logs of the group.
 */
export const GroupCollectionsContext = createContext<GroupState["collections"]>(new Map());

// TODO: many of these are candidates to be split off like the items, to reduce
// excessive updates.

// TODO: XPDrops is a good candidate for the reducer pattern of dispatched
// actions e.g. add drop, delete drop.

type GroupMemberStateSelector<T> = (state: GroupState["memberStates"] | undefined) => T;
export const useGroupMemberContext = <T,>(selector: GroupMemberStateSelector<T>): T => {
  const state = useContext(GroupMemberStatesContext);

  return selector(state);
};

// Selectors for per member state
const createMemberSelector =
  <K extends keyof Member.State>(key: K) =>
  (member: Member.Name): Member.State[K] | undefined =>
    useGroupMemberContext((state) => state?.get(member)?.[key]);

export const useMemberLastUpdatedContext = createMemberSelector("lastUpdated");
export const useMemberBankContext = createMemberSelector("bank");
export const useMemberRunePouchContext = createMemberSelector("runePouch");
export const useMemberSeedVaultContext = createMemberSelector("seedVault");
export const useMemberPohCostumeRoomContext = createMemberSelector("pohCostumeRoom");
export const useMemberQuiverContext = createMemberSelector("quiver");
export const useMemberEquipmentContext = createMemberSelector("equipment");
export const useMemberInventoryContext = createMemberSelector("inventory");
export const useMemberCoordinatesContext = createMemberSelector("coordinates");
export const useMemberInteractingContext = createMemberSelector("interacting");
export const useMemberStatsContext = createMemberSelector("stats");
export const useMemberSkillsContext = createMemberSelector("skills");
export const useMemberQuestsContext = createMemberSelector("quests");
export const useMemberDiariesContext = createMemberSelector("diaries");

/* eslint-enable react-refresh/only-export-components */

// TODO: Use full HSL colors with varying saturation/lightness, since
// perceptively just rotating the colors doesn't look very good.
const memberColorHues: number[] = [330, 100, 230, 170, 40];

type GroupStateAction =
  | { type: "Wipe" }
  | {
      type: "Update";
      /*
       * A partial update has only some of the members e.g. collection-log only
       * returns members who have recorded their logs. If the update is partial, we
       * persist old member states.
       *
       * A non-partial / full update has all of the members e.g. get-group-data always returns all
       * members. If the update is not partial, we wipe old state.
       */
      partial: boolean;
      update: GroupStateUpdate;
    };

/**
 * Taking in the new group state, perform some diff checking and update
 * sparingly. This method also aggregates the items for the group.
 *
 * A lot of these checks should probably be done by the backend and diffs
 * performed in the API class, but for now we can just do the checks here.
 */
const actionUpdate = (oldState: GroupState, action: { partial: boolean; update: GroupStateUpdate }): GroupState => {
  const newState: Partial<GroupState> = {};

  let updated = false;

  const memberNames = ((): Set<Member.Name> => {
    if (action.partial) {
      return new Set([...oldState.memberNames, ...action.update.keys()].sort((a, b) => a.localeCompare(b)));
    }
    return new Set([...action.update.keys()].sort((a, b) => a.localeCompare(b)));
  })();
  const namesHaveChanged = oldState.memberNames.symmetricDifference(memberNames).size > 0;

  if (namesHaveChanged) {
    newState.memberNames = new Set(memberNames);
    updated = true;
  }

  if (namesHaveChanged) {
    const newMemberColors = new Map<Member.Name, MemberColor>();
    const SHARED_NAME = "@SHARED" as Member.Name;
    let colorIndex = Array.from(newMemberColors.keys()).filter((n) => n !== SHARED_NAME).length;
    for (const name of memberNames) {
      if (newMemberColors.has(name)) continue;
      if (name === SHARED_NAME) {
        newMemberColors.set(SHARED_NAME, { hueDegrees: 0 });
        continue;
      }
      const hueDegrees = memberColorHues.at(colorIndex) ?? 0;
      newMemberColors.set(name, { hueDegrees });
      colorIndex += 1;
    }
    newState.memberColors = newMemberColors;
    updated = true;
  }

  {
    const newMemberStates = new Map<Member.Name, Member.State>();
    let memberStatesUpdated = namesHaveChanged;

    for (const member of memberNames) {
      const stateUpdate = action.update.get(member);
      const oldMemberState = oldState.memberStates.get(member);

      if (stateUpdate || !oldMemberState) {
        const containerDefaults = Object.fromEntries(Member.AllItemContainers.map(({ key }) => [key, new Map()]));

        newMemberStates.set(member, {
          lastUpdated: new Date(0),
          ...containerDefaults,
          ...oldMemberState,
          ...stateUpdate,
        } as Member.State);
        memberStatesUpdated = true;
      } else {
        newMemberStates.set(member, oldMemberState);
      }
    }

    if (memberStatesUpdated) {
      updated = true;
      newState.memberStates = newMemberStates;
    }
  }

  if (newState.memberStates) {
    let groupCollectionsUpdated = namesHaveChanged;

    const newCollections = new Map<Member.Name, Member.Collection>();
    for (const [name, { collection: newCollection }] of newState.memberStates) {
      if (newCollection) {
        newCollections.set(name, newCollection);
      }

      let memberChanged = false;
      const oldCollection = oldState.memberStates.get(name)?.collection;
      if (oldCollection) {
        for (const [itemID, oldQuantity] of oldCollection) {
          const newQuantity = newCollection?.get(itemID);
          if (oldQuantity !== newQuantity) {
            memberChanged = true;
            break;
          }
        }
      } else if (newCollection) {
        memberChanged = true;
      }

      if (memberChanged) {
        groupCollectionsUpdated = true;
      }
    }

    if (groupCollectionsUpdated) {
      updated = true;
      newState.collections = newCollections;
    }
  }

  if (newState.memberStates) {
    const newItems: GroupState["items"] = new Map();
    const setContainerQuantity = (
      containerName: Member.ItemContainer,
      memberName: Member.Name,
      { itemID, quantity }: ItemStack,
    ): void => {
      if (!newItems.has(itemID)) newItems.set(itemID, new Map());
      const itemView = newItems.get(itemID)!;
      if (!itemView.has(memberName)) itemView.set(memberName, {});
      const memberBreakdown = itemView.get(memberName)!;

      memberBreakdown[containerName] = (memberBreakdown[containerName] ?? 0) + quantity;
    };

    newState.memberStates.forEach((memberState, memberName) => {
      for (const { name, key, getItems } of Member.AllItemContainers) {
        const data = memberState[key];
        if (!data) continue;

        for (const item of getItems(data)) {
          setContainerQuantity(name, memberName, item);
        }
      }
    });

    let newAndOldItemsEqual = true;

    if (newItems.size !== oldState.items.size) {
      newAndOldItemsEqual = false;
    }

    for (const [itemID, oldBreakdownPerMember] of oldState.items) {
      const newBreakdownPerMember = newItems.get(itemID);
      if (!newBreakdownPerMember) {
        newAndOldItemsEqual = false;
        continue;
      }

      if (oldBreakdownPerMember.size !== newBreakdownPerMember.size) {
        newAndOldItemsEqual = false;
        continue;
      }

      let quantitiesAllEqual = true;
      for (const [member, oldBreakdown] of oldBreakdownPerMember) {
        const newBreakdown = newBreakdownPerMember.get(member);
        if (!newBreakdown) {
          newAndOldItemsEqual = false;
          quantitiesAllEqual = false;
          break;
        }

        for (const containerName of Member.ItemContainer) {
          if (newBreakdown[containerName] !== oldBreakdown[containerName]) {
            newAndOldItemsEqual = false;
            quantitiesAllEqual = false;
            break;
          }
        }
      }
      if (!quantitiesAllEqual) continue;

      newItems.set(itemID, oldBreakdownPerMember);
    }

    if (!newAndOldItemsEqual) {
      updated = true;
      newState.items = newItems;
    }
  }

  if (newState.memberStates) {
    const xpDropsByMember = new Map<Member.Name, Member.ExperienceDrop[]>(oldState.xpDrops);
    for (const [member, { skills: newSkills }] of newState.memberStates) {
      const oldSkills = oldState.memberStates.get(member)?.skills;
      if (!oldSkills || !newSkills) {
        continue;
      }

      const amounts: { skill: Skill; amount: Experience }[] = [];
      for (const skill of Skill) {
        const delta = newSkills[skill] - oldSkills[skill];
        if (delta <= 0) continue;

        amounts.push({ skill, amount: delta as Experience });
      }
      if (amounts.length <= 0) {
        continue;
      }

      const counter = newState.xpDropCounter ?? oldState.xpDropCounter;

      newState.xpDropCounter = counter + 1;
      const oldDrops = xpDropsByMember.get(member) ?? [];
      const newDrop = {
        id: counter,
        amounts: amounts,
        creationTimeMS: performance.now(),
      };
      xpDropsByMember.set(member, [...oldDrops, newDrop]);
      newState.xpDrops = xpDropsByMember;
      updated = true;
    }
  }

  if (!updated) {
    return oldState;
  }

  {
    // Cleanup old xp drops.

    const nowMS = performance.now();
    // Should match animation-duration in xpdropper CSS
    const ANIMATION_TIME_MS = 9600;

    if (newState.xpDrops) {
      for (const [member, drops] of newState.xpDrops) {
        const countBefore = drops.length;
        const newDrops = drops.filter((drop) => {
          const age = nowMS - drop.creationTimeMS;
          return age < ANIMATION_TIME_MS;
        });
        const countAfter = newDrops.length;
        if (countBefore === countAfter) continue;

        newState.xpDrops.set(member, newDrops);
      }
    }
  }

  return { ...oldState, ...newState };
};

const reducer = (oldState: GroupState, action: GroupStateAction): GroupState => {
  switch (action.type) {
    case "Wipe": {
      return {
        items: new Map(),
        memberStates: new Map(),
        memberNames: new Set<Member.Name>(),
        memberColors: new Map(),
        collections: new Map(),
        xpDropCounter: 0,
        xpDrops: new Map(),
      };
    }
    case "Update": {
      return actionUpdate(oldState, action);
    }
  }
};

/**
 * The provider for {@link GroupItemsContext}, {@link GroupMemberStatesContext},
 * {@link GroupMemberStatesContext}, and {@link GroupXPDropsContext}.
 */
export const GroupProvider = ({ children }: { children: ReactNode }): ReactNode => {
  const [contexts, updateContexts] = useReducer(reducer, {
    items: new Map(),
    memberStates: new Map(),
    memberNames: new Set<Member.Name>(),
    memberColors: new Map(),
    collections: new Map(),
    xpDropCounter: 0,
    xpDrops: new Map(),
  });
  const { setUpdateCallbacks } = useContext(APIContext)?.api ?? {};

  useEffect(() => {
    updateContexts({ type: "Wipe" });
    if (!setUpdateCallbacks) return;

    setUpdateCallbacks({
      onGroupUpdate: (update, partial) => {
        updateContexts({ type: "Update", partial, update });
      },
    });
  }, [setUpdateCallbacks]);

  const { items, memberStates, memberNames, xpDrops, memberColors, collections } = contexts;

  return (
    <GroupMemberNamesContext value={memberNames}>
      <GroupMemberColorsContext value={memberColors}>
        <GroupCollectionsContext value={collections}>
          <GroupItemsContext value={items}>
            <GroupMemberStatesContext value={memberStates}>
              <GroupXPDropsContext value={xpDrops}>{children}</GroupXPDropsContext>
            </GroupMemberStatesContext>
          </GroupItemsContext>
        </GroupCollectionsContext>
      </GroupMemberColorsContext>
    </GroupMemberNamesContext>
  );
};
