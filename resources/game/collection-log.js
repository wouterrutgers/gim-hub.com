import collectionLogItemAliases from "./collection-log-item-aliases.json";

export const tabNames = ["Bosses", "Raids", "Clues", "Minigames", "Other"];
const COLLECTION_LOG_ITEM_ALIASES = new Map(
  Object.entries(collectionLogItemAliases).map(function mapAlias([alias, identifier]) {
    return [Number(alias), Number(identifier)];
  }),
);
export function canonicalizeCollectionLogItemId(id) {
  return COLLECTION_LOG_ITEM_ALIASES.get(id) ?? id;
}
