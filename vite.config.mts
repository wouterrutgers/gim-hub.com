import { defineConfig, type PluginOption } from "vite";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import react from "@vitejs/plugin-react";
import { MapMetadataSchema } from "./resources/game/map-data";
import laravel from "laravel-vite-plugin";

const mapJsonPlugin = (): PluginOption => ({
  name: "mapTilesJson",
  buildStart(): void {
    const mapImageFiles = fs
      .readdirSync("public/map")
      .filter((file) => file.endsWith(".webp"))
      .map((file) => path.basename(file, ".webp"));

    const tiles: number[][] = [[], [], [], []];
    for (const mapImageFile of mapImageFiles) {
      const [plane, x, y] = mapImageFile.split("_").map((x) => parseInt(x, 10));
      tiles[plane].push(((x + y) * (x + y + 1)) / 2 + y);
    }

    const map = MapMetadataSchema.safeParse({
      icons: JSON.parse(fs.readFileSync("public/data/map_icons.json", "utf8")) as unknown,
      labels: JSON.parse(fs.readFileSync("public/data/map_labels.json", "utf8")) as unknown,
      tiles: tiles,
    });

    if (!map.success) {
      console.error("Failed to generate 'maps.json'.");
      console.error(map.error);
      return;
    }

    const result = {
      tiles: map.data.tiles,
      icons: map.data.icons,
      labels: map.data.labels,
    };

    fs.writeFileSync("public/data/map.json", JSON.stringify(result, null, 2));
  },
});

/**
 * Fetches categories from the wiki, then indexes these tags by item ID to enable tagged searching.
 */
const wikiTagsPlugin = (): PluginOption => ({
  name: "wikiTags",
  async buildStart(): Promise<void> {
    const categoriesCaseSensitive = ["Herbs", "Logs", "Ores", "Potions", "Runes", "Bars", "Food", "Seeds"];
    const itemNamesByTag: Record<string, string[]> = {};

    for (const category of categoriesCaseSensitive) {
      let names: string[] = [];
      let cmcontinue = "";
      do {
        const url = `https://oldschool.runescape.wiki/api.php?action=query&list=categorymembers&cmtitle=Category:${category}&cmlimit=100&format=json&cmcontinue=${cmcontinue}`;
        const response = await fetch(url);
        const data = (await response.json()) as {
          continue?: { cmcontinue?: string };
          query: { categorymembers: { title: string }[] };
        };
        const itemNames = data.query.categorymembers
          .filter(({ title }) => title !== undefined)
          .map(({ title }) => title.toLowerCase());
        names = [...names, ...itemNames];
        cmcontinue = data.continue?.cmcontinue ?? "";

        // Be kind to the wiki
        await new Promise((resolve) => setTimeout(resolve, 200));
      } while (cmcontinue);

      if (names.length > 0) {
        itemNamesByTag[category.toLowerCase()] = names;
      }
    }

    const tags = Array.from(Object.keys(itemNamesByTag));

    const tagsByItemID: Record<number, string[]> = {};

    const itemDataJSON = JSON.parse(fs.readFileSync("public/data/item_data.json", "utf8")) as Record<
      string,
      { name: string; highalch: number }
    >;
    for (const [itemID, item] of Object.entries(itemDataJSON)) {
      let itemTags: string[] = [];
      for (const tag of tags) {
        const included = itemNamesByTag[tag].some((other) => other === item.name.toLowerCase());
        if (included) {
          itemTags = [...itemTags, tag];
        }
      }

      if (itemTags.length > 0) {
        tagsByItemID[Number.parseInt(itemID)] = itemTags;
      }
    }

    const serialized = JSON.stringify({ tags, items: tagsByItemID }, null, 2);

    fs.writeFileSync("public/data/item_tags.json", serialized);
  },
});

const imageChunksPlugin = (): PluginOption => ({
  name: "imageChunks",
  buildStart(): void {
    console.info("Scanning public directory and creating image chunks...");

    const publicDir = path.join("public", "image-chunks");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const generateHash = (filePath: string): string => {
      const fileBuffer = fs.readFileSync(filePath);
      return crypto.createHash("sha256").update(fileBuffer).digest("hex").substring(0, 6);
    };

    const scanDirectory = (dirPath: string, relativePath = ""): Record<string, string> => {
      const images: Record<string, string> = {};

      if (!fs.existsSync(dirPath)) {
        return images;
      }

      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const itemRelativePath = path.join(relativePath, item).replace(/\\/g, "/");
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          const subImages = scanDirectory(fullPath, itemRelativePath);
          Object.assign(images, subImages);
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if ([".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg"].includes(ext)) {
            const webPath = `/${itemRelativePath}`;

            images[webPath] = generateHash(fullPath);
          }
        }
      }

      return images;
    };

    const allImages = scanDirectory("public");

    const chunks: Record<string, Record<string, string>> = {
      ui: {},
      misc: {},
      "map-misc": {},
    };

    const mapRegions: Record<string, Record<string, string>> = {};

    const iconChunks: Record<string, Record<string, string>> = {
      "icons-misc": {},
    };

    for (const [imagePath, hash] of Object.entries(allImages)) {
      if (imagePath.startsWith("/icons/")) {
        const match = /\/icons\/items\/(\d+)\.webp/.exec(imagePath);
        if (match) {
          const itemId = parseInt(match[1]);
          const chunkIndex = Math.floor(itemId / 1000);
          const chunkKey = `icons-${chunkIndex}`;

          if (!iconChunks[chunkKey]) {
            iconChunks[chunkKey] = {};
          }

          iconChunks[chunkKey][imagePath] = hash;
        } else {
          iconChunks["icons-misc"][imagePath] = hash;
        }
      } else if (imagePath.startsWith("/ui/")) {
        chunks.ui[imagePath] = hash;
      } else if (imagePath.startsWith("/map/")) {
        const match = /\/map\/(\d+)_(\d+)_(\d+)\.webp/.exec(imagePath);
        if (match) {
          const [, z, x, y] = match.map(Number);
          const regionX = Math.floor(x / 20);
          const regionY = Math.floor(y / 20);
          const regionKey = `map-${z}-${regionX}-${regionY}`;

          if (!mapRegions[regionKey]) {
            mapRegions[regionKey] = {};
          }

          mapRegions[regionKey][imagePath] = hash;
        } else {
          chunks["map-misc"][imagePath] = hash;
        }
      } else {
        chunks.misc[imagePath] = hash;
      }
    }

    Object.assign(chunks, mapRegions);
    Object.assign(chunks, iconChunks);

    let totalFiles = 0;
    for (const [chunkName, chunkData] of Object.entries(chunks)) {
      if (Object.keys(chunkData).length > 0) {
        const chunkPath = path.join(publicDir, `${chunkName}.json`);
        fs.writeFileSync(chunkPath, JSON.stringify(chunkData, Object.keys(chunkData).sort()));
        totalFiles++;
      }
    }

    console.info(
      `Scanned ${Object.keys(allImages).length} images and created ${totalFiles} image chunk files in public directory`,
    );
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    mapJsonPlugin(),
    wikiTagsPlugin(),
    imageChunksPlugin(),
    react(),
    laravel({
      input: ["resources/views/index.tsx"],
      refresh: true,
    }),
  ],
  define: {
    __API_URL__: "'/api'",
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
