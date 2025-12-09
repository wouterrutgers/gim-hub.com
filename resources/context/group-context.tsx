import { createContext, type ReactNode, useContext, useEffect, useReducer } from "react";
import * as Member from "../game/member";
import { Context as APIContext } from "./api-context";
import type { ItemID, ItemStack } from "../game/items";
import type { GroupStateUpdate } from "../api/api";
import { type Experience, Skill } from "../game/skill";

interface MemberColor {
  hueDegrees: number;
}
interface GroupState {
  items: Map<ItemID, Map<Member.Name, number>>;
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
export const useMemberLastUpdatedContext = (member: Member.Name): Date | undefined =>
  useGroupMemberContext((state) => state?.get(member)?.lastUpdated);
export const useMemberBankContext = (member: Member.Name): Member.ItemCollection | undefined =>
  useGroupMemberContext((state) => state?.get(member)?.bank);
export const useMemberRunePouchContext = (member: Member.Name): Member.ItemCollection | undefined =>
  useGroupMemberContext((state) => state?.get(member)?.runePouch);
export const useMemberSeedVaultContext = (member: Member.Name): Member.ItemCollection | undefined =>
  useGroupMemberContext((state) => state?.get(member)?.seedVault);
export const useMemberPohCostumeRoomContext = (member: Member.Name): Member.ItemCollection | undefined =>
  useGroupMemberContext((state) => state?.get(member)?.pohCostumeRoom);
export const useMemberQuiverContext = (member: Member.Name): Member.ItemCollection | undefined =>
  useGroupMemberContext((state) => state?.get(member)?.quiver);
export const useMemberEquipmentContext = (member: Member.Name): Member.Equipment | undefined =>
  useGroupMemberContext((state) => state?.get(member)?.equipment);
export const useMemberInventoryContext = (member: Member.Name): Member.Inventory | undefined =>
  useGroupMemberContext((state) => state?.get(member)?.inventory);
export const useMemberCoordinatesContext = (member: Member.Name): Member.Position | undefined =>
  useGroupMemberContext((state) => state?.get(member)?.coordinates);
export const useMemberInteractingContext = (member: Member.Name): Member.NPCInteraction | undefined =>
  useGroupMemberContext((state) => state?.get(member)?.interacting);
export const useMemberStatsContext = (member: Member.Name): Member.Stats | undefined =>
  useGroupMemberContext((state) => state?.get(member)?.stats);
export const useMemberSkillsContext = (member: Member.Name): Member.Skills | undefined =>
  useGroupMemberContext((state) => state?.get(member)?.skills);
export const useMemberQuestsContext = (member: Member.Name): Member.Quests | undefined =>
  useGroupMemberContext((state) => state?.get(member)?.quests);
export const useMemberDiariesContext = (member: Member.Name): Member.Diaries | undefined =>
  useGroupMemberContext((state) => state?.get(member)?.diaries);

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
        newMemberStates.set(member, {
          bank: new Map(),
          equipment: new Map(),
          inventory: [] satisfies Member.Inventory,
          lastUpdated: new Date(0),
          runePouch: new Map(),
          seedVault: new Map(),
          pohCostumeRoom: new Map(),
          quiver: new Map(),
          ...oldMemberState,
          ...stateUpdate,
        });
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
    const newItems = new Map<ItemID, Map<Member.Name, number>>();
    const incrementItemCount = (memberName: Member.Name, { itemID, quantity }: ItemStack): void => {
      if (!newItems.has(itemID)) newItems.set(itemID, new Map<Member.Name, number>());
      const itemView = newItems.get(itemID)!;

      const oldQuantity = itemView.get(memberName) ?? 0;
      itemView.set(memberName, oldQuantity + quantity);
    };

    newState.memberStates.forEach(
      ({ bank, equipment, inventory, runePouch, seedVault, pohCostumeRoom, quiver }, memberName) => {
        // Each item storage is slightly different, so we need to iterate them different.
        [bank, runePouch, seedVault, pohCostumeRoom, quiver].forEach((storageArea) =>
          storageArea.forEach((quantity, itemID) => {
            incrementItemCount(memberName, { quantity, itemID });
          }),
        );
        inventory
          .filter((item) => item !== undefined)
          .forEach((item) => {
            incrementItemCount(memberName, item);
          });
        equipment.forEach((item) => {
          incrementItemCount(memberName, item);
        });
      },
    );

    let newAndOldItemsEqual = true;

    if (newItems.size !== oldState.items.size) {
      newAndOldItemsEqual = false;
    }

    for (const [itemID, oldQuantityPerMember] of oldState.items) {
      const newQuantityPerMember = newItems.get(itemID);
      if (!newQuantityPerMember) {
        newAndOldItemsEqual = false;
        continue;
      }

      if (oldQuantityPerMember.size !== newQuantityPerMember.size) {
        newAndOldItemsEqual = false;
        continue;
      }

      let quantitiesAllEqual = true;
      for (const [member, oldQuantity] of oldQuantityPerMember) {
        const newQuantity = newQuantityPerMember.get(member);
        if (newQuantity !== oldQuantity) {
          newAndOldItemsEqual = false;
          quantitiesAllEqual = false;
          break;
        }
      }
      if (!quantitiesAllEqual) continue;

      newItems.set(itemID, oldQuantityPerMember);
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
