import fs from "node:fs/promises";

const issueTitle = "Missing collection log mappings";
const tabNames = ["Bosses", "Raids", "Clues", "Minigames", "Other"];

async function main() {
  const collectionLogInfo = await readJson("resources/assets/data/collection_log_info.json");
  const mappings = await readJson("resources/components/collection-log/mappings.json");
  const missingMappings = findMissingMappings(collectionLogInfo, mappings);

  if (missingMappings.length === 0) {
    console.log("All collection log pages have mappings.");
    return;
  }

  console.error("Missing collection log mappings:");
  console.error(formatMissingMappings(missingMappings));

  if (process.argv.includes("--github-issue")) {
    await createOrUpdateIssue(missingMappings);
    return;
  }

  process.exitCode = 1;
}

async function readJson(path) {
  return JSON.parse(await fs.readFile(path, "utf8"));
}

function findMissingMappings(collectionLogInfo, mappings) {
  const missingMappings = [];

  for (const tab of collectionLogInfo) {
    for (const page of tab.pages) {
      if (Object.hasOwn(mappings, page.name)) {
        continue;
      }

      missingMappings.push({
        tab: tabNames[tab.tabId] ?? `Tab ${tab.tabId}`,
        page: page.name,
      });
    }
  }

  return missingMappings;
}

function formatMissingMappings(missingMappings) {
  return missingMappings.map(({ tab, page }) => `- ${tab}: ${page}`).join("\n");
}

async function createOrUpdateIssue(missingMappings) {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;

  const existingIssue = await findOpenIssue(token, repository);
  const body = issueBody(repository, missingMappings);

  if (existingIssue) {
    await githubRequest(token, `/repos/${repository}/issues/${existingIssue.number}`, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    });
    console.log(`Updated issue #${existingIssue.number}.`);
    return;
  }

  const issue = await githubRequest(token, `/repos/${repository}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title: issueTitle,
      body,
    }),
  });

  console.log(`Created issue #${issue.number}.`);
}

async function findOpenIssue(token, repository) {
  const searchParams = new URLSearchParams({
    q: `repo:${repository} is:issue is:open in:title "${issueTitle}"`,
  });
  const search = await githubRequest(token, `/search/issues?${searchParams}`);

  return search.items.find((issue) => issue.title === issueTitle);
}

function issueBody(repository, missingMappings) {
  return [
    "The generated collection log data contains pages that are missing from `resources/components/collection-log/mappings.json`.",
    "",
    formatMissingMappings(missingMappings),
    "",
    'Add each page to the mapping file with `"kills"`, an empty array, or explicit completion lines.',
  ].join("\n");
}

async function githubRequest(token, path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "gim-hub-collection-log-mapping-check",
      "x-github-api-version": "2022-11-28",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed with ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

await main();
