import * as fs from "fs";
import * as path from "path";
import wikiTagCategories from "./wiki_tag_categories.json" with { type: "json" };

const CONFIG = {
  itemTagsPath: path.resolve(import.meta.dirname, "../../public/data/item_tags.json"),
  itemDataPath: path.resolve(import.meta.dirname, "../../public/data/item_data.json"),
  userAgent: `gim-hub.com (https://github.com/wouterrutgers/gim-hub.com) ${navigator.userAgent}`,
};

process.stdout.write("Building item tags...\n");

const stdout = process.stdout as Partial<Pick<NodeJS.WriteStream, "isTTY" | "clearLine" | "cursorTo" | "moveCursor">>;
const isTTY = stdout.isTTY === true;
const clearLine = () => isTTY && typeof stdout.clearLine === "function" && stdout.clearLine(0);
const cursorToStart = () => isTTY && typeof stdout.cursorTo === "function" && stdout.cursorTo(0);
const moveCursorUp = () => isTTY && typeof stdout.moveCursor === "function" && stdout.moveCursor(0, -1);

const itemNamesByTag: Record<string, string[]> = {};

let progress = 0;
const total = wikiTagCategories.length;
process.stdout.write(`Fetching categories from wiki: ${progress}/${total}\n`);

for (const [ourNames, wikiNames] of wikiTagCategories) {
  let names = new Set<string>();
  for (const wikiName of wikiNames) {
    clearLine();
    cursorToStart();
    process.stdout.write(`>>>>${wikiName}${isTTY ? "" : "\n"}`);

    let cmcontinue = "";
    do {
      const url = `https://oldschool.runescape.wiki/api.php?action=query&list=categorymembers&cmtitle=Category:${wikiName}&cmlimit=100&format=json&cmcontinue=${cmcontinue}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": CONFIG.userAgent,
        },
      });
      const data = (await response.json()) as {
        continue?: { cmcontinue?: string };
        query: { categorymembers: { title: string }[] };
      };
      const itemNames = data.query.categorymembers
        .filter(({ title }) => title !== undefined)
        .map(({ title }) => title.toLowerCase());

      if (wikiName === "Potions") {
        // Manually add potion variants as they are not included in the Wiki category
        const expandedItemNames: string[] = [];
        for (const itemName of itemNames) {
          expandedItemNames.push(itemName);
          for (let i = 1; i <= 4; i++) {
            expandedItemNames.push(`${itemName}(${i})`);
          }
        }
        itemNames.push(...expandedItemNames);
      }

      names = new Set([...names, ...itemNames]);
      cmcontinue = data.continue?.cmcontinue ?? "";

      // Be kind to the wiki
      await new Promise((resolve) => setTimeout(resolve, 200));
    } while (cmcontinue);
  }

  for (const ourName of ourNames) {
    if (names.size > 0) {
      itemNamesByTag[ourName.toLowerCase()] = Array.from(names);
    }
  }

  progress++;
  clearLine();
  moveCursorUp();
  clearLine();
  cursorToStart();
  process.stdout.write(`Fetching categories from wiki: ${progress}/${total}\n`);
}

cursorToStart();
clearLine();

const tags = Array.from(Object.keys(itemNamesByTag)).sort(
  (a, b) => itemNamesByTag[b].length - itemNamesByTag[a].length,
);

const bitIndexByTag: Record<string, bigint> = {};
{
  let bitIndexCount = 0n;
  for (const tag of tags) {
    bitIndexByTag[tag] = bitIndexCount;
    bitIndexCount++;
  }
}

const tagBitMaskByItemID: Record<number, bigint> = {};

const itemDataJSON = JSON.parse(fs.readFileSync(CONFIG.itemDataPath, "utf8")) as Record<
  string,
  { name: string; highalch: number }
>;
for (const [itemID, item] of Object.entries(itemDataJSON)) {
  let itemBitMask = 0n;
  for (const tag of tags) {
    const included = itemNamesByTag[tag].some((other) => other === item.name.toLowerCase());
    if (included) {
      itemBitMask += 1n << bitIndexByTag[tag];
    }
  }

  if (itemBitMask !== 0n) {
    tagBitMaskByItemID[Number.parseInt(itemID)] = itemBitMask;
  }
}

const serialized = JSON.stringify(
  { tags, items: tagBitMaskByItemID },
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  (_, value) => (typeof value === "bigint" ? value.toString() : value),
  2,
);

fs.writeFileSync(CONFIG.itemTagsPath, serialized);
process.stdout.write(`Wrote results to ${CONFIG.itemTagsPath}\n`);
