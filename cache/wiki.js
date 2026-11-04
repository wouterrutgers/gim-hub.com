async function fetchWiki(url) {
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

  return body;
}

module.exports = fetchWiki;
