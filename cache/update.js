const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const fetchWiki = require("./wiki");
const { buildMapLabels } = require("./map-labels");

const osrsCacheDirectory = path.resolve("./cache/cache");

const RUNELITE_PATHS = (() => {
  const root = path.resolve("./runelite");
  const cache = path.resolve(root, "cache");
  const api = path.resolve(root, "runelite-api");

  return {
    DIRS: {
      root,
      cache,
      api,
      client: path.resolve(root, "runelite-client"),
    },
    BUILD_SCRIPTS: {
      cache: path.resolve(cache, "build.gradle.kts"),
      api: path.resolve(api, "build.gradle.kts"),
      client: path.resolve(root, "runelite-client/build.gradle.kts"),
    },
  };
})();

const SITE_PATHS = (() => {
  const resources = path.resolve("../resources");
  const assets = path.join(resources, "assets");

  return {
    FILES: {
      itemData: path.resolve(assets, "data/item_data.json"),
      mapMetadata: path.resolve(assets, "data/map.json"),
      mapIconAtlas: path.resolve(assets, "map-misc/map_icons.webp"),
      questMapping: path.resolve(resources, "js/quests/mapping.json"),
    },
    DIRS: {
      itemImages: path.resolve(assets, "item-icons"),
      mapImages: path.resolve(assets, "map-tiles"),
      mapLabels: path.resolve(assets, "map-misc"),
    },
  };
})();

function exec(command, commandArguments, options) {
  console.info(`[exec] ${[command, ...commandArguments].join(" ")}`);
  childProcess.execFileSync(command, commandArguments, { ...options, stdio: "inherit" });
}

async function retry(action) {
  const attempts = 10;
  for (let i = 0; i < attempts; ++i) {
    try {
      await action();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  await action();
}

function execGitCleanInRunelite() {
  exec("git", ["clean", "-ffdq"], { cwd: RUNELITE_PATHS.DIRS.root });
  exec("git", ["reset", "--hard", "-q"], { cwd: RUNELITE_PATHS.DIRS.root });
}

function prepareRuneliteGradleApplication(buildScriptPath, dependencies) {
  let lines = fs.readFileSync(buildScriptPath).toString("utf8").split("\n");
  const lineOfPlugins = lines.findIndex((line) => !!line.match("plugins"));
  if (lineOfPlugins < 0) {
    throw new Error(`No plugins block in ${buildScriptPath}`);
  }

  lines = [...lines.slice(0, lineOfPlugins + 1), "application", ...lines.slice(lineOfPlugins + 1)];
  lines.push("", 'tasks.named<JavaExec>("run") {', 'mainClass.set(providers.gradleProperty("dumpMainClass"))', "}", "");

  if (dependencies.length > 0) {
    const lineOfDependencies = lines.findIndex((line) => !!line.match("dependencies"));
    if (lineOfDependencies < 0) {
      throw new Error(`No dependencies block in ${buildScriptPath}`);
    }
    lines = [...lines.slice(0, lineOfDependencies + 1), ...dependencies, ...lines.slice(lineOfDependencies + 1)];
  }

  fs.writeFileSync(buildScriptPath, lines.join("\n"));
}

function prepareRunelite(buildScriptPath) {
  const dependencies = [];

  if (buildScriptPath === RUNELITE_PATHS.BUILD_SCRIPTS.cache) {
    for (const name of [
      "Cache",
      "MapImageDumper",
      "MapTiles",
      "MapLabelDumper",
      "CollectionLogDumper",
      "CombatAchievementDumper",
    ]) {
      fs.copyFileSync(`./${name}.java`, `${RUNELITE_PATHS.DIRS.cache}/src/main/java/net/runelite/cache/${name}.java`);
    }

    fs.copyFileSync(
      "./ItemSpriteFactory.java",
      `${RUNELITE_PATHS.DIRS.cache}/src/main/java/net/runelite/cache/item/ItemSpriteFactory.java`,
    );
  }

  if (buildScriptPath === RUNELITE_PATHS.BUILD_SCRIPTS.api) {
    fs.mkdirSync(`${RUNELITE_PATHS.DIRS.api}/src/main/java/net/runelite/client/game`, { recursive: true });
    fs.mkdirSync(`${RUNELITE_PATHS.DIRS.api}/src/main/resources`, { recursive: true });

    for (const stub of [
      "src/main/java/net/runelite/client/game/ItemMapping.java",
      "src/main/java/net/runelite/client/game/ItemVariationMapping.java",
      "src/main/resources/item_variations.json",
    ]) {
      fs.copyFileSync(path.resolve(RUNELITE_PATHS.DIRS.client, stub), path.resolve(RUNELITE_PATHS.DIRS.api, stub));
    }

    for (const name of ["ItemDumper", "QuestDumper"]) {
      fs.copyFileSync(`./${name}.java`, `${RUNELITE_PATHS.DIRS.api}/src/main/java/net/runelite/api/${name}.java`);
    }

    dependencies.push(
      "implementation(libs.gson)",
      "implementation(libs.guava)",
      'implementation("com.fasterxml.jackson.core:jackson-databind:2.17.0")',
    );
  }

  if (buildScriptPath === RUNELITE_PATHS.BUILD_SCRIPTS.client) {
    fs.copyFileSync(
      "./BossIconDumper.java",
      path.resolve(
        RUNELITE_PATHS.DIRS.client,
        "src/main/java/net/runelite/client/plugins/chatcommands/BossIconDumper.java",
      ),
    );
    dependencies.push('implementation("net.runelite:cache:${project.version}")');
  }

  prepareRuneliteGradleApplication(buildScriptPath, dependencies);
}

async function execRuneliteGradleApplication({ buildScriptPath, mainClass, runArgs }) {
  execGitCleanInRunelite();
  prepareRunelite(buildScriptPath);
  const gradlew = path.resolve(RUNELITE_PATHS.DIRS.root, "gradlew");
  const commandArguments = [
    "-b",
    buildScriptPath,
    "--build-cache",
    "-q",
    "run",
    `-PdumpMainClass=${mainClass}`,
    `--args=${runArgs}`,
  ];
  console.info(`[exec] ${[gradlew, ...commandArguments].join(" ")}`);
  await new Promise(function runGradle(resolve, reject) {
    const application = childProcess.spawn(gradlew, commandArguments, {
      cwd: RUNELITE_PATHS.DIRS.root,
      stdio: "inherit",
      env: {
        ...process.env,
        JAVA_TOOL_OPTIONS: "-Xmx4g -Djava.awt.headless=true -Dorg.slf4j.simpleLogger.defaultLogLevel=error",
      },
    });
    application.once("error", reject);
    application.once("close", function finished(code) {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${mainClass} exited with code ${code}`));
    });
  });
}

async function dumpItemData() {
  console.info("\nStep: Dumping items from cache");
  await execRuneliteGradleApplication({
    buildScriptPath: RUNELITE_PATHS.BUILD_SCRIPTS.cache,
    mainClass: "net.runelite.cache.Cache",
    runArgs: `-c ${osrsCacheDirectory} -items ${path.resolve("./item-data.json")}`,
  });

  console.info("\nStep: Converting cache item data");
  await execRuneliteGradleApplication({
    buildScriptPath: RUNELITE_PATHS.BUILD_SCRIPTS.api,
    mainClass: "net.runelite.api.ItemDumper",
    runArgs: path.resolve("./item-data.json"),
  });
}

async function getNonAlchableItemNames() {
  console.log("\nStep: Fetching unalchable items from wiki");
  const nonAlchableItemNames = new Set();
  let cmcontinue = "";
  do {
    const url = `https://oldschool.runescape.wiki/api.php?cmtitle=Category:Items_that_cannot_be_alchemised&action=query&list=categorymembers&format=json&cmlimit=500&cmcontinue=${cmcontinue}`;
    const response = JSON.parse(await fetchWiki(url));
    const itemNames = response.query.categorymembers
      .map((member) => member.title)
      .filter((title) => !title.startsWith("File:") && !title.startsWith("Category:"));
    itemNames.forEach((name) => nonAlchableItemNames.add(name));
    cmcontinue = response.continue?.cmcontinue || null;
  } while (cmcontinue);

  return nonAlchableItemNames;
}

async function buildItemDataJson() {
  console.log("\nStep: Build item_data.json");
  const items = JSON.parse(fs.readFileSync("./item-data.json", "utf8"));
  const includedItems = {};
  const allIncludedItemIds = new Set();
  for (const [itemId, item] of Object.entries(items)) {
    if (item.name && item.name.trim().toLowerCase() !== "null") {
      const includedItem = {
        name: item.name,
        highalch: Math.floor(item.cost * 0.6),
        alchable: true,
        mapping: item.mapping,
      };

      const stackedList = [];
      if (item.countCo && item.countObj && item.countCo.length > 0 && item.countObj.length > 0) {
        for (let i = 0; i < item.countCo.length; ++i) {
          const stackBreakPoint = item.countCo[i];
          const stackedItemId = item.countObj[i];

          if (stackBreakPoint > 0 && stackedItemId === 0) {
            console.log(`${itemId}: Item has a stack breakpoint without an associated item id for that stack.`);
          } else if (stackBreakPoint > 0 && stackedItemId > 0) {
            allIncludedItemIds.add(stackedItemId);
            stackedList.push([stackBreakPoint, stackedItemId]);
          }
        }

        if (stackedList.length > 0) {
          includedItem.stacks = stackedList;
        }
      }

      allIncludedItemIds.add(item.id);
      includedItems[itemId] = includedItem;
    }
  }

  const nonAlchableItemNames = await getNonAlchableItemNames();

  let itemsMadeNonAlchable = 0;
  for (const item of Object.values(includedItems)) {
    const itemName = item.name;
    if (nonAlchableItemNames.has(itemName)) {
      item.highalch = 0;
      item.alchable = false;
      itemsMadeNonAlchable++;
    }

    // NOTE: The wiki data does not list every variant of an item such as 'Abyssal lantern (yew logs)'
    // which is also not alchable. So this step is to handle that case by searching for the non variant item.
    if (itemName.trim().endsWith(")") && itemName.indexOf("(") !== -1) {
      const nonVariantItemName = itemName.substring(0, itemName.indexOf("(")).trim();
      if (nonAlchableItemNames.has(nonVariantItemName)) {
        item.highalch = 0;
        item.alchable = false;
        itemsMadeNonAlchable++;
      }
    }
  }
  console.log(`${itemsMadeNonAlchable} items were updated to be unalchable`);
  fs.writeFileSync("./item_data.json", JSON.stringify(includedItems, null, 2));

  return allIncludedItemIds;
}

async function dumpItemImages(allIncludedItemIds) {
  console.info(`\nStep: Generating images for ${allIncludedItemIds.size} items`);
  fs.rmSync("./item-images", { recursive: true, force: true });
  fs.writeFileSync("items_need_images.csv", [...allIncludedItemIds].join(","));
  await execRuneliteGradleApplication({
    buildScriptPath: RUNELITE_PATHS.BUILD_SCRIPTS.cache,
    mainClass: "net.runelite.cache.Cache",
    runArgs: `-c ${osrsCacheDirectory} -ids ${path.resolve("./items_need_images.csv")} -output ${path.resolve("./item-images")}`,
  });
}

async function convertXteasToRuneliteFormat() {
  const xteas = JSON.parse(fs.readFileSync(`${osrsCacheDirectory}/../xteas.json`, "utf8"));
  let result = xteas.map((region) => ({
    region: region.mapsquare,
    keys: region.key,
  }));

  const location = path.resolve(`${osrsCacheDirectory}/../xteas-runelite.json`);
  fs.writeFileSync(location, JSON.stringify(result, null, 2));

  return location;
}

async function dumpMapData(xteasLocation) {
  console.info("\nStep: Dumping map data");
  fs.rmSync("./map-data", { recursive: true, force: true });
  await execRuneliteGradleApplication({
    buildScriptPath: RUNELITE_PATHS.BUILD_SCRIPTS.cache,
    mainClass: "net.runelite.cache.MapImageDumper",
    runArgs: `--cachedir ${osrsCacheDirectory} --xteapath ${xteasLocation} --outputdir ${path.resolve("./map-data")}`,
  });
}

async function dumpMapLabels() {
  console.info("\nStep: Dumping map labels");
  await execRuneliteGradleApplication({
    buildScriptPath: RUNELITE_PATHS.BUILD_SCRIPTS.cache,
    mainClass: "net.runelite.cache.MapLabelDumper",
    runArgs: `--cachedir ${osrsCacheDirectory} --outputdir ${path.resolve("./map-data/labels")}`,
  });
  await require("./images").convertPngImages(path.resolve("./map-data/labels"));
}

async function dumpCollectionLog() {
  console.info("\nStep: Dumping collection log");
  await execRuneliteGradleApplication({
    buildScriptPath: RUNELITE_PATHS.BUILD_SCRIPTS.cache,
    mainClass: "net.runelite.cache.CollectionLogDumper",
    runArgs: `--cachedir ${osrsCacheDirectory} --outputdir ${path.resolve("../resources/assets/data")}`,
  });
}

async function moveFiles(files, destination) {
  for (const file of files) {
    const base = path.parse(file).base;
    await retry(() => fs.renameSync(file, `${destination}/${base}`));
  }
}

async function moveResults() {
  console.log("\nStep: Moving results to site");
  const replacements = [
    ["./item-images", SITE_PATHS.DIRS.itemImages],
    ["./map-data/tiles", SITE_PATHS.DIRS.mapImages],
    ["./map-data/labels", SITE_PATHS.DIRS.mapLabels],
  ].map(function findReplacements([source, destination]) {
    const files = fs
      .readdirSync(source)
      .filter(function isWebp(file) {
        return file.endsWith(".webp");
      })
      .map(function sourcePath(file) {
        return path.join(source, file);
      });
    if (files.length === 0) {
      throw new Error(`No replacement files found for ${source}.`);
    }
    return { files, destination };
  });

  await retry(() => fs.copyFileSync("./item_data.json", SITE_PATHS.FILES.itemData));

  for (const { files, destination } of replacements) {
    await retry(() => fs.rmSync(destination, { recursive: true, force: true }));
    fs.mkdirSync(destination, { recursive: true });
    await moveFiles(files, destination);
  }
  fs.mkdirSync(path.dirname(SITE_PATHS.FILES.mapIconAtlas), { recursive: true });

  fs.copyFileSync("./map-data/map.json", SITE_PATHS.FILES.mapMetadata);
  fs.copyFileSync("./map-data/map_icons.webp", SITE_PATHS.FILES.mapIconAtlas);
}

async function buildMapJsonAndIconAtlas() {
  const sharp = require("sharp");
  console.info("Step: Building map json and icon atlas...");

  // Create a tile sheet of the map icons
  const mapIcons = fs
    .readdirSync("./map-data/icons")
    .filter(function isPng(file) {
      return file.endsWith(".png");
    })
    .sort()
    .map(function iconPath(file) {
      return path.resolve("./map-data/icons", file);
    });
  if (mapIcons.length === 0) {
    console.warn("No mapIcons to process into atlas.");
  } else {
    console.info(`Copying ${mapIcons.length} dumped .png mapIcons to the .webp atlas.`);
  }

  let mapIconsCompositeOpts = [];
  const iconIdToSpriteMapIndex = {};
  for (let i = 0; i < mapIcons.length; ++i) {
    mapIconsCompositeOpts.push({
      input: mapIcons[i],
      left: 15 * i,
      top: 0,
    });

    iconIdToSpriteMapIndex[path.basename(mapIcons[i], ".png")] = i;
  }
  await sharp({
    create: {
      width: 15 * mapIcons.length,
      height: 15,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(mapIconsCompositeOpts)
    .webp({ lossless: true, effort: 6 })
    .toFile("./map-data/map_icons.webp");

  // Convert the output of the map-icons locations to be keyed by the X an Y of the regions
  // that they are in. This is done so that the canvas map component can quickly lookup
  // all of the icons in each of the regions that are being shown.
  const mapIconsMeta = JSON.parse(fs.readFileSync("./map-data/icons/map-icons.json", "utf8"));
  const locationByRegion = {};

  for (const [iconId, coordinates] of Object.entries(mapIconsMeta)) {
    for (let i = 0; i < coordinates.length; i += 2) {
      const x = coordinates[i] + 128;
      const y = coordinates[i + 1] + 1;

      const regionX = Math.floor(x / 64);
      const regionY = Math.floor(y / 64);

      const spriteMapIndex = iconIdToSpriteMapIndex[iconId];
      if (spriteMapIndex === undefined) {
        throw new Error("Could not find sprite map index for map icon: " + iconId);
      }

      locationByRegion[regionX] = locationByRegion[regionX] || {};
      locationByRegion[regionX][regionY] = locationByRegion[regionX][regionY] || {};
      locationByRegion[regionX][regionY][spriteMapIndex] = locationByRegion[regionX][regionY][spriteMapIndex] || [];

      locationByRegion[regionX][regionY][spriteMapIndex].push(x, y);
    }
  }

  // Do the same for map labels
  const mapLabelsMeta = JSON.parse(fs.readFileSync("./map-data/labels/map-labels.json", "utf8"));
  const { labels, labelNames } = buildMapLabels(mapLabelsMeta);

  const mapImageFiles = fs
    .readdirSync("map-data/tiles")
    .filter((file) => file.endsWith(".webp"))
    .map((file) => path.basename(file, ".webp"));

  const tiles = [[], [], [], []];
  for (const mapImageFile of mapImageFiles) {
    const [plane, x, y] = mapImageFile.split("_").map((x) => parseInt(x, 10));
    tiles[plane].push(((x + y) * (x + y + 1)) / 2 + y);
  }

  const map = {
    tiles: tiles,
    icons: locationByRegion,
    labels,
    labelNames,
  };

  fs.writeFileSync("./map-data/map.json", JSON.stringify(map, null, 2));
}

async function dumpQuestMapping() {
  console.info("Dumping quest mappings.");
  await execRuneliteGradleApplication({
    buildScriptPath: RUNELITE_PATHS.BUILD_SCRIPTS.api,
    mainClass: "net.runelite.api.QuestDumper",
    runArgs: SITE_PATHS.FILES.questMapping,
  });
}

async function dumpCombatAchievements() {
  console.info("Dumping combat achievements.");
  await execRuneliteGradleApplication({
    buildScriptPath: RUNELITE_PATHS.BUILD_SCRIPTS.cache,
    mainClass: "net.runelite.cache.CombatAchievementDumper",
    runArgs: `${osrsCacheDirectory} ${path.resolve("../resources/assets/data/combat_achievements.json")}`,
  });
}

async function dumpBossIcons() {
  console.info("Dumping boss icons.");
  await execRuneliteGradleApplication({
    buildScriptPath: RUNELITE_PATHS.BUILD_SCRIPTS.client,
    mainClass: "net.runelite.client.plugins.chatcommands.BossIconDumper",
    runArgs: `${osrsCacheDirectory} ${path.resolve("../resources/assets/icons")} ${path.resolve("../resources/assets/data/boss_icons.json")}`,
  });
}

(async () => {
  try {
    const wikiOnly = process.argv.includes("--wiki-only");
    await dumpItemData();
    const allIncludedItemIds = await buildItemDataJson();
    await dumpQuestMapping();
    await dumpBossIcons();

    if (wikiOnly) {
      fs.copyFileSync("./item_data.json", SITE_PATHS.FILES.itemData);
      return;
    }

    const images = require("./images");
    await dumpItemImages(allIncludedItemIds);
    const xteasLocation = await convertXteasToRuneliteFormat();
    const mapDump = dumpMapData(xteasLocation);
    const results = await Promise.allSettled([
      images.convertPngImages(path.resolve("./item-images")),
      mapDump.then(function generateMapTiles() {
        return images.generateMapTiles(path.resolve("./map-data"));
      }),
      mapDump.then(async function dumpMapMetadata() {
        await dumpMapLabels();
        await dumpCollectionLog();
        await dumpCombatAchievements();
      }),
    ]);

    for (const result of results) {
      if (result.status === "rejected") {
        throw result.reason;
      }
    }

    await buildMapJsonAndIconAtlas();
    await moveResults();
  } finally {
    execGitCleanInRunelite();
  }
})();
