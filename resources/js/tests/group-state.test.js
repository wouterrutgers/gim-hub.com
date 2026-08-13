import { describe, expect, it } from "vite-plus/test";
import { skills } from "../../game/skill";
import {
  createGroupState,
  mapGroupResponse,
  updateGroupMemberColors,
  updateGroupState,
} from "../../stores/group-state";

describe("group state", function describeGroupState() {
  it("maps API updates to the frontend domain", function testResponseMapping() {
    const quests = new Map([
      [12, { name: "Quest one" }],
      [34, { name: "Quest two" }],
    ]);
    const lastUpdated = new Date("2026-08-13T10:00:00.000Z");
    const { updates, colorUpdates, newestTimestamp } = mapGroupResponse(
      [
        {
          name: "Wise Old Man",
          coordinates: { x: 3200, y: 3201, plane: 1, isOnBoat: true },
          quests: ["FINISHED"],
          colorHueDegrees: 230,
          lastUpdated,
        },
      ],
      quests,
    );

    expect(updates.get("Wise Old Man")).toEqual({
      coordinates: { coords: { x: 3200, y: 3201 }, plane: 1, isOnBoat: true },
      quests: new Map([
        [12, "FINISHED"],
        [34, "NOT_STARTED"],
      ]),
      lastUpdated,
    });
    expect(colorUpdates).toEqual(new Map([["Wise Old Man", 230]]));
    expect(newestTimestamp).toBe(lastUpdated);
  });

  it("merges partial collection updates without dropping live member data", function testPartialUpdate() {
    const initialState = updateGroupState(
      createGroupState(),
      new Map([
        [
          "Wise Old Man",
          {
            bank: new Map([[995, { itemID: 995, quantity: 5 }]]),
            skills: { Attack: 100 },
          },
        ],
      ]),
      { colorUpdates: new Map([["Wise Old Man", 230]]) },
    );
    const collection = new Map([[11802, 1]]);
    const updatedState = updateGroupState(initialState, new Map([["Wise Old Man", { collection }]]), { partial: true });

    expect(updatedState.memberStates.get("Wise Old Man").bank).toBe(initialState.memberStates.get("Wise Old Man").bank);
    expect(updatedState.collections.get("Wise Old Man")).toBe(collection);
    expect(updatedState.items.get(995).get("Wise Old Man")).toEqual({ Bank: 5 });
  });

  it("replaces members during a full update", function testFullUpdate() {
    const initialState = updateGroupState(
      createGroupState(),
      new Map([
        ["Wise Old Man", {}],
        ["Hans", {}],
      ]),
    );
    const updatedState = updateGroupState(initialState, new Map([["Hans", {}]]));

    expect(updatedState.memberNames).toEqual(new Set(["Hans"]));
    expect(updatedState.memberStates.has("Wise Old Man")).toBe(false);
  });

  it("rebuilds derived collections and items", function testDerivedState() {
    const initialCollection = new Map([[11802, 1]]);
    const initialState = updateGroupState(
      createGroupState(),
      new Map([
        [
          "Wise Old Man",
          {
            bank: new Map([[995, { itemID: 995, quantity: 5 }]]),
            collection: initialCollection,
          },
        ],
      ]),
    );
    const collection = new Map([...initialCollection, [12922, 1]]);
    const updatedState = updateGroupState(
      initialState,
      new Map([
        [
          "Wise Old Man",
          {
            bank: new Map([[995, { itemID: 995, quantity: 7 }]]),
            collection,
          },
        ],
      ]),
    );

    expect(updatedState.collections.get("Wise Old Man")).toBe(collection);
    expect(updatedState.items.get(995).get("Wise Old Man")).toEqual({ Bank: 7 });
  });

  it("preserves unchanged derived collection and item references", function testUnchangedDerivedState() {
    const initialState = updateGroupState(
      createGroupState(),
      new Map([
        [
          "Wise Old Man",
          {
            bank: new Map([[995, { itemID: 995, quantity: 5 }]]),
            collection: new Map([[11802, 1]]),
          },
        ],
      ]),
    );
    const updatedState = updateGroupState(
      initialState,
      new Map([
        [
          "Wise Old Man",
          {
            bank: new Map([[995, { itemID: 995, quantity: 5 }]]),
            collection: new Map([[11802, 1]]),
          },
        ],
      ]),
    );

    expect(updatedState.collections).toBe(initialState.collections);
    expect(updatedState.items).toBe(initialState.items);
  });

  it("creates experience drops from increased skill experience", function testExperienceDrops() {
    const initialSkills = Object.fromEntries(
      skills.map(function createSkillExperience(skill) {
        return [skill, 100];
      }),
    );
    const initialState = updateGroupState(createGroupState(), new Map([["Wise Old Man", { skills: initialSkills }]]));
    const updatedState = updateGroupState(
      initialState,
      new Map([["Wise Old Man", { skills: { ...initialSkills, Attack: 125 } }]]),
    );

    expect(updatedState.xpDrops.get("Wise Old Man")).toMatchObject([
      {
        id: 0,
        amounts: [{ skill: "Attack", amount: 25 }],
      },
    ]);
    expect(updatedState.xpDropCounter).toBe(1);
  });

  it("preserves the state reference for an empty partial update", function testNoUpdate() {
    const state = updateGroupState(createGroupState(), new Map([["Wise Old Man", {}]]));

    expect(updateGroupState(state, new Map(), { partial: true })).toBe(state);
  });

  it("updates only known member colors", function testMemberColorUpdate() {
    const state = updateGroupState(createGroupState(), new Map([["Wise Old Man", {}]]), {
      colorUpdates: new Map([["Wise Old Man", 230]]),
    });
    const updatedState = updateGroupMemberColors(state, [
      { name: "Wise Old Man", hueDegrees: 330 },
      { name: "Unknown", hueDegrees: 100 },
    ]);

    expect(updatedState.memberColors).toEqual(new Map([["Wise Old Man", { hueDegrees: 330 }]]));
  });

  it("preserves the state reference when no member color changes", function testNoMemberColorUpdate() {
    const state = updateGroupState(createGroupState(), new Map([["Wise Old Man", {}]]), {
      colorUpdates: new Map([["Wise Old Man", 230]]),
    });

    expect(updateGroupMemberColors(state, [{ name: "Unknown", hueDegrees: 100 }])).toBe(state);
  });
});
