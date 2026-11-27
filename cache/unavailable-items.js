const fetchWiki = require("./wiki");

const WIKI_PAGES = ["Interface items", "Unobtainable items"];
const OWNABLE_SECTIONS = new Set(["Discontinued after 2013", "Have since been released", "Formerly noted items"]);
const ITEM_TABLE = /^\{\|[^\n]*\n!(?:[^\n|]*\|)?[ \t]*ID(?: number)?[ \t]*\n([\s\S]*?)^\|\}/gm;
const ITEM_ROW = /^\|-[^\n]*\n\|[ \t]*(\d+)[ \t]*\n\|[^\n]*\n\|([^\n]*)/gm;

async function loadUnavailableItemIds(items) {
  const url = new URL("https://oldschool.runescape.wiki/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    titles: WIKI_PAGES.join("|"),
  });

  const { query } = JSON.parse(await fetchWiki(url.toString()));
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

  return unavailable.difference(ownable);
}

module.exports = { loadUnavailableItemIds };
