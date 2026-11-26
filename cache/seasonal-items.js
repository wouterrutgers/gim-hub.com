const { parseStringPromise } = require("xml2js");
const fetchWiki = require("./wiki");

const leagueItemGroups = new Set(["gameplay items", "echo equipment", "echo orbs"]);

async function queryWiki(parameters) {
  const url = new URL("https://oldschool.runescape.wiki/api.php");
  url.search = new URLSearchParams({ action: "query", format: "json", formatversion: "2", ...parameters });

  return JSON.parse(await fetchWiki(url.toString()));
}

async function leagueNavboxes() {
  const navboxes = new Set();
  const leagueInfobox =
    /\{\{Infobox Temporary Game Mode\b(?:(?!^[ \t]*\}\})[\s\S])*?^[ \t]*\|[ \t]*type[ \t]*=[ \t]*Leagues[ \t]*$/im;
  let continuation;

  do {
    const response = await queryWiki({
      generator: "embeddedin",
      geititle: "Template:Infobox Temporary Game Mode",
      geinamespace: "0",
      geilimit: "max",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      ...continuation,
    });

    for (const page of response.query.pages) {
      const content = page.revisions?.[0]?.slots.main.content ?? "";
      if (!leagueInfobox.test(content)) {
        continue;
      }

      const expectedNames = new Set([page.title, page.title.replace(/ \(\d{4}\)$/, "")]);
      const navbox = [...content.matchAll(/^[ \t]*\{\{([^{}|\r\n]+)(?:\|[^{}\r\n]*)?\}\}[ \t]*$/gm)]
        .map(([, name]) => name.trim())
        .find((name) => expectedNames.has(name));

      if (navbox) {
        navboxes.add(`Template:${navbox}`);
      } else {
        console.warn(`No league navigation template found for ${page.title}.`);
      }
    }

    continuation = response.continue;
  } while (continuation);

  return navboxes;
}

function wikiText(node) {
  return typeof node === "string" ? node : (node?._ ?? "");
}

function* leagueItemTitles(node, inItemGroup = false) {
  if (inItemGroup) {
    for (const [, title] of wikiText(node).matchAll(/\[\[([^|\]]+)(?:\|[^\]]*)?\]\]/g)) {
      yield title.trim();
    }
  }

  for (const template of node?.template ?? []) {
    const name = template.title[0].trim().toLowerCase();

    if (name === "plink" && inItemGroup) {
      const link = template.part.find((part) => part.name[0]?.$?.index === "1");
      yield wikiText(link?.value[0]).trim();
    }

    if (name !== "navbox") {
      continue;
    }

    const parameters = new Map(
      template.part
        .filter((part) => typeof part.name[0] === "string")
        .map((part) => [part.name[0].trim(), part.value[0]]),
    );

    for (const [parameter, value] of parameters) {
      const number = parameter.match(/^group(\d+)$/)?.[1];
      if (!number) {
        continue;
      }

      const title = wikiText(parameters.get(`gtitle${number}`))
        .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, "$1")
        .trim()
        .toLowerCase();

      if (title === "rewards" || title === "scroll boxes") {
        continue;
      }

      yield* leagueItemTitles(value, inItemGroup || leagueItemGroups.has(title));
    }
  }
}

async function loadSeasonalItemPages() {
  const modes = new Map();
  let continuation;

  do {
    const response = await queryWiki({
      list: "categorymembers",
      cmtitle: "Category:Deadman seasonal items",
      cmnamespace: "0",
      cmlimit: "500",
      ...continuation,
    });

    for (const { title } of response.query.categorymembers) {
      modes.set(title, "deadman");
    }

    continuation = response.continue;
  } while (continuation);

  for (const page of await leagueNavboxes()) {
    const { parse } = await queryWiki({ action: "parse", page, prop: "parsetree" });
    const { root } = await parseStringPromise(parse.parsetree);
    for (const title of leagueItemTitles(root)) {
      modes.set(title, "leagues");
    }
  }

  return modes;
}

module.exports = { loadSeasonalItemPages };
