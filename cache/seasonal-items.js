const { parseStringPromise } = require("xml2js");
const { categoryMemberTitles, queryWiki } = require("./wiki");

const leagueItemGroups = new Set(["gameplay items", "echo equipment", "echo orbs"]);
const rewardGroups = new Set(["rewards", "scroll boxes"]);

async function temporaryModeNavboxes() {
  const navboxes = new Map();
  const modeInfobox =
    /\{\{Infobox Temporary Game Mode\b(?:(?!^[ \t]*\}\})[\s\S])*?^[ \t]*\|[ \t]*type[ \t]*=[ \t]*(Leagues|Community event|Temporary)[ \t]*$/im;
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
      const mode = content.match(modeInfobox)?.[1].toLowerCase();
      if (!mode) {
        continue;
      }

      const expectedNames = new Set([page.title, page.title.replace(/ \(\d{4}\)$/, "")]);
      const navbox = [...content.matchAll(/^[ \t]*\{\{([^{}|\r\n]+)(?:\|[^{}\r\n]*)?\}\}[ \t]*$/gm)]
        .map(([, name]) => name.trim())
        .find((name) => expectedNames.has(name));

      if (navbox) {
        navboxes.set(navbox, mode);
      } else {
        console.warn(`No temporary mode navigation template found for ${page.title}.`);
      }
    }

    continuation = response.continue;
  } while (continuation);

  return navboxes;
}

function wikiText(node) {
  return typeof node === "string" ? node : (node?._ ?? "");
}

function* navboxItemTitles(node, groups, inItemGroup = false) {
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

      if (groups === leagueItemGroups && rewardGroups.has(title)) {
        continue;
      }

      yield* navboxItemTitles(value, groups, inItemGroup || groups.has(title));
    }
  }
}

async function loadSeasonalItemPages() {
  const modes = new Map();
  const eventPages = new Set();

  for await (const title of categoryMemberTitles("Deadman seasonal items")) {
    modes.set(title, "deadman");
  }

  for (const [navbox, mode] of await temporaryModeNavboxes()) {
    const { parse } = await queryWiki({ action: "parse", page: `Template:${navbox}`, prop: "parsetree" });
    const { root } = await parseStringPromise(parse.parsetree);
    if (mode === "leagues") {
      for (const title of navboxItemTitles(root, leagueItemGroups)) {
        modes.set(title, "leagues");
      }

      continue;
    }

    const rewards = new Set(navboxItemTitles(root, rewardGroups));
    for await (const title of categoryMemberTitles(navbox)) {
      if (!rewards.has(title)) {
        eventPages.add(title);
      }
    }
  }

  return { modes, eventPages };
}

module.exports = { loadSeasonalItemPages };
