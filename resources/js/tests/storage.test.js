import { describe, expect, it } from "vite-plus/test";
import { parseGroupData } from "../../api/requests/group-data";
import { createGroupState, updateGroupState, mapGroupResponse } from "../../stores/group-state";
import { stashItemLocations } from "../../game/member";

function update(state, data) {
  return updateGroupState(state, mapGroupResponse(parseGroupData(data), new Map()).updates, { partial: true });
}

function unit(id, name, state, items, alternatives = []) {
  return { id, name, tier: "Easy", state, items, alternatives };
}

describe("storage integration", function describeStorage() {
  it("includes every portable container in quantities and preserves missing fields", function portableQuantities() {
    const state = update(createGroupState(), [
      {
        name: "Alice",
        bank: [199, 3],
        herb_sack: [199, 12],
        looting_bag: [199, 5],
        seed_box: [5295, 8],
        gem_bag: [1623, 20],
        chugging_barrel: [2430, 15],
      },
    ]);
    expect(state.items.get(199).get("Alice")).toEqual({ Bank: 3, "Herb sack": 12, "Looting bag": 5 });
    expect(state.items.get(5295).get("Alice")).toEqual({ "Seed box": 8 });
    expect(state.items.get(1623).get("Alice")).toEqual({ "Gem bag": 20 });
    expect(state.items.get(2430).get("Alice")).toEqual({ "Chugging barrel": 15 });
    const unchanged = update(state, [{ name: "Alice", herb_sack: null }]);
    expect(unchanged.items).toBe(state.items);
    const empty = update(unchanged, [{ name: "Alice", herb_sack: [] }]);
    expect(empty.items.get(199).get("Alice")).toEqual({ Bank: 3, "Looting bag": 5 });
  });

  it("counts each STASH unit once and retains locations for identical items", function stashQuantities() {
    const units = [
      unit(28958, "Lumbridge Swamp", "filled", [1095, 1]),
      unit(28959, "Wizards' Tower", "filled", [1095, 1]),
      unit(28960, "Draynor", "empty", []),
    ];
    const state = update(createGroupState(), [{ name: "Alice", stash_units: units }]);
    const repeated = update(state, [{ name: "Alice", stash_units: units }]);
    expect(repeated.items.get(1095).get("Alice")).toEqual({ "STASH units": 2 });
    expect(repeated.items).toBe(state.items);
    expect(stashItemLocations(repeated.memberStates.get("Alice").stashUnits, 1095)).toEqual([
      { id: 28958, name: "Lumbridge Swamp", tier: "Easy", quantity: 1 },
      { id: 28959, name: "Wizards' Tower", tier: "Easy", quantity: 1 },
    ]);
    const emptied = update(repeated, [
      { name: "Alice", stash_units: [unit(28958, "Lumbridge Swamp", "empty", []), units[1], units[2]] },
    ]);
    expect(emptied.items.get(1095).get("Alice")).toEqual({ "STASH units": 1 });
  });

  it("includes exact STASH contents without counting unresolved variants or unbuilt units", function knownStashContents() {
    const state = update(createGroupState(), [
      {
        name: "Alice",
        stash_units: [
          unit(28958, "Lumbridge Swamp", "filled", [1095, 1]),
          unit(29019, "Kharazi Jungle", "filled", [], ["Any stole", "Any heraldic rune shield"]),
          unit(34736, "Varrock", "unbuilt", []),
        ],
      },
    ]);
    expect([...state.items.keys()]).toEqual([1095]);
  });

  it("accepts older member data without storage fields", function oldPayload() {
    const state = update(createGroupState(), [{ name: "Alice", bank: [995, 10] }]);
    expect(state.memberStates.get("Alice").stashUnits.size).toBe(0);
    expect(state.items.get(995).get("Alice")).toEqual({ Bank: 10 });
  });
});
