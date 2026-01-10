const child_process = require("child_process");
const fs = require("fs");
const glob = require("glob");
const nAsync = require("async");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");

// NOTE: sharp will keep some files open and prevent them from being deleted
sharp.cache(false);

const osrsCacheDirectory = path.resolve("./cache/cache");
const tileSize = 256;

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
    },
  };
})();

const SITE_PATHS = (() => {
  const public = path.resolve("../public");
  const resources = path.resolve("../resources");

  return {
    FILES: {
      itemData: path.resolve(resources, "assets/data/item_data.json"),
      mapMetadata: path.resolve(resources, "assets/data/map.json"),
      mapIconAtlas: path.resolve(public, "map/icons/map_icons.webp"),
      questMapping: path.resolve(resources, "js/quests/mapping.json"),
    },
    DIRS: {
      itemImages: path.resolve(public, "icons/items"),
      mapImages: path.resolve(public, "map"),
      mapLabels: path.resolve(public, "map/labels"),
    },
  };
})();

function exec(command, options) {
  console.log(`[exec] ${command}`);
  options = options || {};
  options.stdio = "inherit";
  child_process.execSync(command, options);
}

async function retry(fn, skipLast) {
  const attempts = 10;
  for (let i = 0; i < attempts; ++i) {
    try {
      await fn();
      return;
    } catch (ex) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (i === attempts - 1 && skipLast) {
        console.error(ex);
      }
    }
  }

  if (!skipLast) {
    fn();
  }
}

function execGitCleanInRunelite() {
  exec(`git clean -ffdxq`, { cwd: RUNELITE_PATHS.DIRS.root });
  exec(`git reset --hard -q`, { cwd: RUNELITE_PATHS.DIRS.root });
}

function execRuneliteGradleApplication(args) {
  const { buildScriptPath, mainClass, dependencies, runArgs } = args;
  let lines = fs.readFileSync(buildScriptPath).toString("utf8").split("\n");

  if (typeof mainClass === "string" && mainClass.length > 0) {
    const lineOfPlugins = lines.findIndex((line) => !!line.match("plugins"));
    if (lineOfPlugins < 0) {
      throw new Error(`No plugins block in ${buildScriptPath}`);
    }
    lines = [...lines.slice(0, lineOfPlugins + 1), "application", ...lines.slice(lineOfPlugins + 1)];

    lines.push("", "application {", `mainClass = "${mainClass}"`, "}", "");
  }

  if (Array.isArray(dependencies) && dependencies.length > 0) {
    const lineOfDependencies = lines.findIndex((line) => !!line.match("dependencies"));
    if (lineOfDependencies < 0) {
      throw new Error(`No dependencies block in ${buildScriptPath}`);
    }
    lines = [...lines.slice(0, lineOfDependencies + 1), ...dependencies, ...lines.slice(lineOfDependencies + 1)];
  }

  fs.writeFileSync(buildScriptPath, lines.join("\n"));

  const gradlew = "./gradlew".replace("/", path.sep);
  exec(`${gradlew} -b ${buildScriptPath} -q run --args="${runArgs}"`, {
    cwd: RUNELITE_PATHS.DIRS.root,
    env: {
      ...process.env,
      JAVA_TOOL_OPTIONS: "-Xmx4g -Dorg.slf4j.simpleLogger.defaultLogLevel=error",
    },
  });
}

async function readAllItemFiles() {
  const itemFiles = glob.sync(`${path.resolve("./item-data")}/*.json`.replace(/\\/g, "/"));

  if (itemFiles.length === 0) {
    throw new Error("No item files in item-data to read.");
  }

  const result = {};

  const q = nAsync.queue((itemFile, callback) => {
    fs.promises.readFile(itemFile, "utf8").then((itemFileData) => {
      const item = JSON.parse(itemFileData);
      if (isNaN(item.id)) console.log(item);
      result[item.id] = item;

      callback();
    });
  }, 50);

  for (const itemFile of itemFiles) {
    q.push(itemFile);
  }

  await q.drain();

  return result;
}

async function dumpItemData() {
  try {
    console.log("\nStep: Dumping items from cache");
    execRuneliteGradleApplication({
      buildScriptPath: RUNELITE_PATHS.BUILD_SCRIPTS.cache,
      mainClass: "net.runelite.cache.Cache",
      dependencies: [],
      runArgs: `-c ${osrsCacheDirectory} -items ${path.resolve("./item-data")}`,
    });

    console.log("\nStep: Converting cache item data");
    fs.mkdirSync(`${RUNELITE_PATHS.DIRS.api}/src/main/java/net/runelite/client/game/`, { recursive: true });
    fs.mkdirSync(`${RUNELITE_PATHS.DIRS.api}/src/main/resources`, { recursive: true });

    for (const stub of [
      "src/main/java/net/runelite/client/game/ItemMapping.java",
      "src/main/java/net/runelite/client/game/ItemVariationMapping.java",
      "src/main/resources/item_variations.json",
    ]) {
      const from = path.resolve(RUNELITE_PATHS.DIRS.client, stub);
      const to = path.resolve(RUNELITE_PATHS.DIRS.api, stub);
      fs.copyFileSync(from, to);
    }

    fs.copyFileSync(
      "./ItemDumper.java",
      path.resolve(RUNELITE_PATHS.DIRS.api, "src/main/java/net/runelite/api/ItemDumper.java"),
    );

    execRuneliteGradleApplication({
      buildScriptPath: RUNELITE_PATHS.BUILD_SCRIPTS.api,
      mainClass: "net.runelite.api.ItemDumper",
      dependencies: [
        "implementation(libs.gson)",
        "implementation(libs.guava)",
        `implementation("com.fasterxml.jackson.core:jackson-databind:2.17.0")`,
      ],
      runArgs: path.resolve(`./item-data`),
    });
  } catch (e) {
    console.error("Failed to dumpItemData");
    console.error(e);
  }
  execGitCleanInRunelite();
}

async function getNonAlchableItemNames() {
  console.log("\nStep: Fetching unalchable items from wiki");
  const nonAlchableItemNames = new Set();
  let cmcontinue = "";
  do {
    const url = `https://oldschool.runescape.wiki/api.php?cmtitle=Category:Items_that_cannot_be_alchemised&action=query&list=categorymembers&format=json&cmlimit=500&cmcontinue=${cmcontinue}`;
    const response = await axios.get(url);
    const itemNames = response.data.query.categorymembers
      .map((member) => member.title)
      .filter((title) => !title.startsWith("File:") && !title.startsWith("Category:"));
    itemNames.forEach((name) => nonAlchableItemNames.add(name));
    cmcontinue = response.data?.continue?.cmcontinue || null;
  } while (cmcontinue);

  return nonAlchableItemNames;
}

async function buildItemDataJson() {
  console.log("\nStep: Build item_data.json");
  const items = await readAllItemFiles();
  const includedItems = {};
  const allIncludedItemIds = new Set();
  for (const [itemId, item] of Object.entries(items)) {
    if (item.name && item.name.trim().toLowerCase() !== "null") {
      includedItem = {
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
  // TODO: Zoom on holy symbol is incorrect
  console.log("\nStep: Extract item model images");

  try {
    console.log(`Generating images for ${allIncludedItemIds.size} items`);
    fs.writeFileSync("items_need_images.csv", Array.from(allIncludedItemIds.values()).join(","));
    const imageDumperDriver = fs.readFileSync("./Cache.java", "utf8");
    fs.writeFileSync(`${RUNELITE_PATHS.DIRS.cache}/src/main/java/net/runelite/cache/Cache.java`, imageDumperDriver);
    const itemSpriteFactory = fs.readFileSync("./ItemSpriteFactory.java", "utf8");
    fs.writeFileSync(
      `${RUNELITE_PATHS.DIRS.cache}/src/main/java/net/runelite/cache/item/ItemSpriteFactory.java`,
      itemSpriteFactory,
    );

    execRuneliteGradleApplication({
      buildScriptPath: RUNELITE_PATHS.BUILD_SCRIPTS.cache,
      mainClass: "net.runelite.cache.Cache",
      dependencies: [],
      runArgs: `-c ${osrsCacheDirectory} -ids ${path.resolve("./items_need_images.csv")} -output ${path.resolve("./item-images")}`,
    });

    const itemImages = glob.sync(`${path.resolve("./item-images")}/*.png`.replace(/\\/g, "/"));
    if (itemImages.length === 0) {
      console.warn("No item-images to convert to .webp.");
    } else {
      console.info(`Converting ${itemImages.length} dumped .png item images to .webp.`);
    }

    let p = [];
    for (const itemImage of itemImages) {
      p.push(
        new Promise(async (resolve) => {
          const itemImageData = await sharp(itemImage).webp({ lossless: true }).toBuffer();
          fs.unlinkSync(itemImage);
          await sharp(itemImageData)
            .webp({ lossless: true, effort: 6 })
            .toFile(itemImage.replace(".png", ".webp"))
            .then(resolve);
        }),
      );
    }
    await Promise.all(p);
  } catch (e) {
    console.error("Failed to dumpItemImages");
    console.error(e);
  }
  execGitCleanInRunelite();
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
  console.log("\nStep: Dumping map data");
  try {
    const mapImageDumper = fs.readFileSync("./MapImageDumper.java", "utf8");
    fs.writeFileSync(
      `${RUNELITE_PATHS.DIRS.cache}/src/main/java/net/runelite/cache/MapImageDumper.java`,
      mapImageDumper,
    );

    execRuneliteGradleApplication({
      buildScriptPath: RUNELITE_PATHS.BUILD_SCRIPTS.cache,
      mainClass: "net.runelite.cache.MapImageDumper",
      dependencies: [],
      runArgs: `--cachedir ${osrsCacheDirectory} --xteapath ${xteasLocation} --outputdir ${path.resolve("./map-data")}`,
    });
  } catch (e) {
    console.error("Failed to dumpMapData");
    console.error(e);
  }
  execGitCleanInRunelite();
}

async function dumpMapLabels() {
  console.log("\nStep: Dumping map labels");
  try {
    const mapLabelDumper = fs.readFileSync("./MapLabelDumper.java", "utf8");
    fs.writeFileSync(
      `${RUNELITE_PATHS.DIRS.cache}/src/main/java/net/runelite/cache/MapLabelDumper.java`,
      mapLabelDumper,
    );

    execRuneliteGradleApplication({
      buildScriptPath: RUNELITE_PATHS.BUILD_SCRIPTS.cache,
      mainClass: "net.runelite.cache.MapLabelDumper",
      dependencies: [],
      runArgs: `--cachedir ${osrsCacheDirectory} --outputdir ${path.resolve("./map-data/labels")}`,
    });

    const mapLabels = glob.sync(path.resolve("./map-data/labels/*.png").replace(/\\/g, "/"));
    if (mapLabels.length === 0) {
      console.warn("No map labels to convert to .webp.");
    } else {
      console.info(`Converting ${mapLabels.length} dumped .png map labels to .webp.`);
    }

    let p = [];
    for (const mapLabel of mapLabels) {
      p.push(
        new Promise(async (resolve) => {
          const mapLabelImageData = await sharp(mapLabel).webp({ lossless: true }).toBuffer();
          fs.unlinkSync(mapLabel);
          await sharp(mapLabelImageData)
            .webp({ lossless: true, effort: 6 })
            .toFile(mapLabel.replace(".png", ".webp"))
            .then(resolve);
        }),
      );
    }
    await Promise.all(p);
  } catch (e) {
    console.error("Failed to dumpMapLabels");
    console.error(e);
  }
  execGitCleanInRunelite();
}

async function dumpCollectionLog() {
  console.log("\nStep: Dumping collection log");
  try {
    const collectionLogDumper = fs.readFileSync("./CollectionLogDumper.java", "utf8");
    fs.writeFileSync(
      `${RUNELITE_PATHS.DIRS.cache}/src/main/java/net/runelite/cache/CollectionLogDumper.java`,
      collectionLogDumper,
    );

    execRuneliteGradleApplication({
      buildScriptPath: RUNELITE_PATHS.BUILD_SCRIPTS.cache,
      mainClass: "net.runelite.cache.CollectionLogDumper",
      dependencies: [],
      runArgs: `--cachedir ${osrsCacheDirectory} --outputdir ${path.resolve("../storage/cache")}`,
    });
  } catch (e) {
    console.error("Failed to dumpCollectionLog");
    console.error(e);
  }
  execGitCleanInRunelite();
}

async function tilePlane(plane) {
  await retry(() => fs.rmSync("./output_files", { recursive: true, force: true }));
  const planeImage = sharp(`./map-data/img-${plane}.png`, { limitInputPixels: false }).flip();
  await planeImage
    .webp({ lossless: true })
    .tile({
      size: tileSize,
      depth: "one",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      skipBlanks: 0,
    })
    .toFile("output.dz");
}

async function outputTileImage(s, plane, x, y) {
  return s
    .flatten({ background: "#000" })
    .webp({ lossless: true, alphaQuality: 0, effort: 6 })
    .toFile(`./map-data/tiles/${plane}_${x}_${y}.webp`);
}

async function finalizePlaneTiles(plane, previousTiles) {
  const tileImages = glob.sync(path.resolve("./output_files/0/*.webp").replace(/\\/g, "/"));
  if (tileImages.length === 0) {
    console.warn("No tileImages to convert to .webp.");
  } else {
    console.info(`Processing ${tileImages.length} dumped .png tileImages to .webp.`);
  }

  const p = [];
  for (const tileImage of tileImages) {
    p.push(
      new Promise(async (resolve) => {
        const filename = path.basename(tileImage, ".webp");
        const [x, y] = filename.split("_").map((coord) => parseInt(coord, 10));

        const finalX = x + 4608 / tileSize;
        const finalY = y + 4864 / tileSize;

        let s;
        if (plane > 0) {
          const backgroundPath = `./map-data/tiles/${plane - 1}_${finalX}_${finalY}.webp`;
          const backgroundExists = fs.existsSync(backgroundPath);

          if (backgroundExists) {
            const tile = await sharp(tileImage).flip().webp({ lossless: true }).toBuffer();
            const background = await sharp(backgroundPath).linear(0.5).webp({ lossless: true }).toBuffer();
            s = sharp(background).composite([{ input: tile }]);
          }
        }

        if (!s) {
          s = sharp(tileImage).flip();
        }

        previousTiles.add(`${plane}_${finalX}_${finalY}`);
        await outputTileImage(s, plane, finalX, finalY);

        resolve();
      }),
    );
  }
  await Promise.all(p);

  // NOTE: This is just so the plane will have a darker version of the tile below it
  // even if the plane does not have its own image for a tile.
  if (plane > 0) {
    const belowTiles = [...previousTiles].filter((x) => x.startsWith(plane - 1));
    for (const belowTile of belowTiles) {
      const [belowPlane, x, y] = belowTile.split("_");
      const lookup = `${plane}_${x}_${y}`;
      if (!previousTiles.has(lookup)) {
        const outputPath = `./map-data/tiles/${plane}_${x}_${y}.webp`;
        if (fs.existsSync(outputPath) === true) {
          throw new Error(`Filling tile ${outputPath} but it already exists!`);
        }

        const s = sharp(`./map-data/tiles/${belowTile}.webp`).linear(0.5);
        previousTiles.add(lookup);
        await outputTileImage(s, plane, x, y);
      }
    }
  }
}

async function generateMapTiles() {
  console.log("\nStep: Generate map tiles");
  fs.rmSync("./map-data/tiles", { recursive: true, force: true });
  fs.mkdirSync("./map-data/tiles");

  const previousTiles = new Set();
  const planes = 4;
  for (let i = 0; i < planes; ++i) {
    console.log(`Tiling map plane ${i + 1}/${planes}`);
    await tilePlane(i);
    console.log(`Finalizing map plane ${i + 1}/${planes}`);
    await finalizePlaneTiles(i, previousTiles);
  }
}

async function moveFiles(globSource, destination) {
  const files = glob.sync(path.resolve(globSource).replace(/\\/g, "/"));
  if (files.length === 0) {
    console.warn("No files to move, matching glob: " + globSource);
  }
  for (file of files) {
    const base = path.parse(file).base;
    if (base) {
      await retry(() => fs.renameSync(file, `${destination}/${base}`), true);
    }
  }
}

async function moveResults() {
  console.log("\nStep: Moving results to site");
  await retry(() => fs.copyFileSync("./item_data.json", SITE_PATHS.FILES.itemData), true);

  // Clean up destination folders before moving new files
  console.log("Removing old destination folders...");
  await retry(() => fs.rmSync(SITE_PATHS.DIRS.itemImages, { recursive: true, force: true }), true);
  await retry(() => fs.rmSync(SITE_PATHS.DIRS.mapImages, { recursive: true, force: true }), true);
  await retry(() => fs.rmSync(SITE_PATHS.DIRS.mapLabels, { recursive: true, force: true }), true);

  // Recreate destination folders
  fs.mkdirSync(SITE_PATHS.DIRS.itemImages, { recursive: true });
  fs.mkdirSync(SITE_PATHS.DIRS.mapImages, { recursive: true });
  fs.mkdirSync(SITE_PATHS.DIRS.mapLabels, { recursive: true });
  fs.mkdirSync(path.dirname(SITE_PATHS.FILES.mapIconAtlas), { recursive: true });

  await moveFiles("./item-images/*.webp", SITE_PATHS.DIRS.itemImages);
  await moveFiles("./map-data/tiles/*.webp", SITE_PATHS.DIRS.mapImages);
  await moveFiles("./map-data/labels/*.webp", SITE_PATHS.DIRS.mapLabels);

  fs.copyFileSync("./map-data/map.json", SITE_PATHS.FILES.mapMetadata);
  fs.copyFileSync("./map-data/map_icons.webp", SITE_PATHS.FILES.mapIconAtlas);
}

async function buildMapJsonAndIconAtlas() {
  console.info("Step: Building map json and icon atlas...");

  // Create a tile sheet of the map icons
  const mapIcons = glob.sync(path.resolve("./map-data/icons/*.png").replace(/\\/g, "/"));
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
  const labelByRegion = {};

  for (let i = 0; i < mapLabelsMeta.length; ++i) {
    const coordinates = mapLabelsMeta[i];
    const x = coordinates[0] + 128;
    const y = coordinates[1] + 1;
    const z = coordinates[2];

    const regionX = Math.floor(x / 64);
    const regionY = Math.floor(y / 64);

    labelByRegion[regionX] = labelByRegion[regionX] || {};
    labelByRegion[regionX][regionY] = labelByRegion[regionX][regionY] || {};
    labelByRegion[regionX][regionY][z] = labelByRegion[regionX][regionY][z] || [];

    labelByRegion[regionX][regionY][z].push(x, y, i);
  }

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
    labels: labelByRegion,
  };

  fs.writeFileSync("./map-data/map.json", JSON.stringify(map, null, 2));
}

async function dumpQuestMapping() {
  console.log("Dumping quest mappings.");
  try {
    fs.copyFileSync("./QuestDumper.java", `${RUNELITE_PATHS.DIRS.api}/src/main/java/net/runelite/api/QuestDumper.java`);
    execRuneliteGradleApplication({
      buildScriptPath: RUNELITE_PATHS.BUILD_SCRIPTS.api,
      mainClass: "net.runelite.api.QuestDumper",
      dependencies: [`implementation("com.fasterxml.jackson.core:jackson-databind:2.17.0")`],
      runArgs: SITE_PATHS.FILES.questMapping,
    });
  } catch (e) {
    console.error("Failed to dumpQuestMapping.");
    console.error(e);
  }
  execGitCleanInRunelite();
}

(async () => {
  execGitCleanInRunelite();

  await dumpItemData();
  const allIncludedItemIds = await buildItemDataJson();
  await dumpItemImages(allIncludedItemIds);
  const xteasLocation = await convertXteasToRuneliteFormat();
  await dumpMapData(xteasLocation);
  await generateMapTiles();
  await dumpMapLabels();
  await dumpCollectionLog();
  await buildMapJsonAndIconAtlas();
  await moveResults();

  await dumpQuestMapping();
})();
