async function fetchWiki(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "gim-hub.com (https://github.com/wouterrutgers/gim-hub.com)",
    },
  });

  if (!response.ok) {
    throw Object.assign(new Error(`Unable to fetch ${url}: HTTP ${response.status}`), { status: response.status });
  }

  const body = await response.text();

  if (new URL(url).pathname === "/api.php") {
    const data = JSON.parse(body);

    if (data.error) {
      throw new Error(`Wiki API error: ${data.error.info ?? data.error}`);
    }
  }

  return body;
}

async function queryWiki(parameters) {
  const url = new URL("https://oldschool.runescape.wiki/api.php");
  url.search = new URLSearchParams({ action: "query", format: "json", formatversion: "2", ...parameters });

  return JSON.parse(await fetchWiki(url.toString()));
}

async function* categoryMemberTitles(category) {
  let continuation;

  do {
    const response = await queryWiki({
      list: "categorymembers",
      cmtitle: `Category:${category}`,
      cmnamespace: "0",
      cmlimit: "500",
      ...continuation,
    });

    for (const { title } of response.query.categorymembers) {
      yield title;
    }

    continuation = response.continue;
  } while (continuation);
}

module.exports = fetchWiki;
module.exports.queryWiki = queryWiki;
module.exports.categoryMemberTitles = categoryMemberTitles;
