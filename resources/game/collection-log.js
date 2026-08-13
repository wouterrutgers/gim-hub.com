export const tabNames = ["Bosses", "Raids", "Clues", "Minigames", "Other"];
const COLLECTION_LOG_ITEM_ALIASES = new Map([
  [25629, 24882],
  [29992, 29990],
  [25630, 12854],
  [25617, 10859],
  [25618, 10877],
  [25619, 10878],
  [25620, 10879],
  [25621, 10880],
  [25622, 10881],
  [25623, 10882],
  [25627, 12019],
  [25628, 12020],
  [29472, 12013],
  [29474, 12014],
  [29476, 12015],
  [29478, 12016],
]);
export function canonicalizeCollectionLogItemId(id) {
  return COLLECTION_LOG_ITEM_ALIASES.get(id) ?? id;
}
