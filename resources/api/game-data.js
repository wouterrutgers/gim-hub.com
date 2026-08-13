import { fetchDiaryData } from "../game/diaries";
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
    [
      "gePrices",
      function fetchPrices() {
        return fetchGEPrices({ baseURL });
      },
    ],
    ["collectionLogInfo", fetchCollectionLogInfo],
  ];
  const results = await Promise.allSettled(
    sources.map(function fetchSource([, fetchSourceData]) {
      return fetchSourceData();
    }),
  );
  const gameData = {};

  results.forEach(function storeResult(result, index) {
    const [name] = sources[index];

    if (result.status === "fulfilled") {
      gameData[name] = result.value;
    } else {
      console.error(`Failed to fetch ${name}:`, result.reason);
    }
  });

  return gameData;
}
