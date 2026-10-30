import { fetchDiaryData } from "../game/diaries";
import { fetchCombatAchievementData } from "../game/combat-achievements";
import { fetchItemData, fetchItemTags } from "../game/items";
import { fetchQuestData } from "../game/quests";
import { fetchCollectionLogInfo } from "./requests/collection-log-info";
import { fetchGEPrices } from "./requests/ge-prices";

export async function fetchGameData(baseURL) {
  const sources = [
    ["quests", fetchQuestData],
    ["items", fetchItemData],
    ["itemTags", fetchItemTags],
    ["diaries", fetchDiaryData],
    ["combatAchievements", fetchCombatAchievementData],
    [
      "gePrices",
      function fetchPrices() {
        return fetchGEPrices({ baseURL });
      },
    ],
    ["collectionLogInfo", fetchCollectionLogInfo],
  ];
  const results = await Promise.all(
    sources.map(async function fetchSource([name, fetchSourceData]) {
      return [name, await fetchSourceData()];
    }),
  );

  return Object.fromEntries(results);
}
