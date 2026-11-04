import fs from "node:fs";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import wikiTagCategories from "./wiki_tag_categories.json" with { type: "json" };
import fetchWiki from "../wiki.js";

const itemTagsPath = path.resolve(import.meta.dirname, "../../resources/assets/data/item_tags.json");
const itemDataPath = path.resolve(import.meta.dirname, "../../resources/assets/data/item_data.json");
const itemNamesByTag = new Map();

console.info("Building item tags...");

for (const [ourNames, wikiNames] of wikiTagCategories) {
  const names = new Set();
  for (const wikiName of wikiNames) {
    console.info(`Fetching category: ${wikiName}`);

    let cmcontinue = "";
    do {
      const url = `https://oldschool.runescape.wiki/api.php?action=query&list=categorymembers&cmtitle=Category:${wikiName}&cmlimit=500&format=json&cmcontinue=${cmcontinue}`;
      const data = JSON.parse(await fetchWiki(url));
      for (const { title } of data.query.categorymembers) {
        if (title === undefined) {
          continue;
        }

        const itemName = title.toLowerCase();
        names.add(itemName);
        if (wikiName === "Potions") {
          for (let i = 1; i <= 4; i++) {
            names.add(`${itemName}(${i})`);
          }
        }
      }

      cmcontinue = data.continue?.cmcontinue ?? "";
      await setTimeout(200);
    } while (cmcontinue);
  }

  for (const ourName of ourNames) {
    if (names.size > 0) {
      itemNamesByTag.set(ourName.toLowerCase(), names);
    }
  }
}

const tags = [...itemNamesByTag.keys()].sort(
  (first, second) => itemNamesByTag.get(second).size - itemNamesByTag.get(first).size,
);
const masksByItemName = new Map();
for (const [index, tag] of tags.entries()) {
  for (const name of itemNamesByTag.get(tag)) {
    masksByItemName.set(name, (masksByItemName.get(name) ?? 0n) | (1n << BigInt(index)));
  }
}

const items = {};
for (const [itemIdentifier, item] of Object.entries(JSON.parse(fs.readFileSync(itemDataPath, "utf8")))) {
  const mask = masksByItemName.get(item.name.toLowerCase());

  if (mask !== undefined) {
    items[itemIdentifier] = mask.toString();
  }
}

fs.writeFileSync(itemTagsPath, JSON.stringify({ tags, items }, null, 2));
console.info(`Wrote results to ${itemTagsPath}`);
