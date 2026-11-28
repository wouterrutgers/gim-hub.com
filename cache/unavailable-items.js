const { categoryMemberTitles, queryWiki } = require("./wiki");

const WIKI_PAGES = ["Interface items", "Unobtainable items"];
const RESTRICTED_CATEGORIES = ["Beta items", "Jagex moderator items"];
const OWNABLE_SECTIONS = new Set(["Discontinued after 2013", "Have since been released", "Formerly noted items"]);
const ITEM_TABLE = /^\{\|[^\n]*\n!(?:[^\n|]*\|)?[ \t]*ID(?: number)?[ \t]*\n([\s\S]*?)^\|\}/gm;
const ITEM_ROW = /^\|-[^\n]*\n\|[ \t]*(\d+)[ \t]*\n\|[^\n]*\n\|([^\n]*)/gm;

async function loadUnavailableItemIds(items) {
  const { query } = await queryWiki({
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    titles: WIKI_PAGES.join("|"),
  });

  const unavailable = new Set();
  const ownable = new Set();

  for (const title of WIKI_PAGES) {
    const page = query.pages.find((page) => page.title === title);
    const content = page?.revisions?.[0]?.slots.main.content ?? "";
    let itemCount = 0;

    for (const section of content.split(/(?=^==+[^=\n])/m)) {
      const heading = section.match(/^==+[ \t]*(.*?)[ \t]*==+[ \t]*$/m)?.[1];
      const itemIds = OWNABLE_SECTIONS.has(heading) ? ownable : unavailable;

      for (const [, rows] of section.matchAll(ITEM_TABLE)) {
        for (const [, itemId, label] of rows.matchAll(ITEM_ROW)) {
          const name = label
            .replace(/\[\[(?:[^|\]]+\|)?([^|\]]+)\]\]/g, "$1")
            .trim()
            .toLowerCase();

          if (items[itemId]?.name.trim().toLowerCase() === name) {
            itemIds.add(Number(itemId));
            itemCount += 1;
          }
        }
      }
    }

    if (!itemCount) {
      throw new Error(`No catalogue items matched the Wiki page "${title}".`);
    }
  }

  return { unavailable: unavailable.difference(ownable), ownable };
}

async function loadRestrictedItemPages() {
  const categories = await Promise.all(
    RESTRICTED_CATEGORIES.map((category) => Array.fromAsync(categoryMemberTitles(category))),
  );

  return new Set(categories.flat());
}

module.exports = { loadUnavailableItemIds, loadRestrictedItemPages };
