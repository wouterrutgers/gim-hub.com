const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

async function fetchWiki(url) {
  const cacheFile = path.join(
    __dirname,
    "wiki-responses",
    `${crypto.createHash("sha256").update(url).digest("hex")}.json`,
  );

  if (fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));

    if (Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000) {
      return cached.body;
    }
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": "gim-hub.com (https://github.com/wouterrutgers/gim-hub.com)",
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}: HTTP ${response.status}`);
  }

  const body = await response.text();

  if (new URL(url).pathname === "/api.php") {
    const data = JSON.parse(body);

    if (data.error) {
      throw new Error(`Wiki API error: ${data.error.info}`);
    }
  }

  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify({ fetchedAt: Date.now(), body }));

  return body;
}

module.exports = fetchWiki;
