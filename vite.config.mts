import { defineConfig, type PluginOption } from "vite";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import react from "@vitejs/plugin-react";
import laravel from "laravel-vite-plugin";

const imageChunksHardVersionedPlugin = (): PluginOption => ({
  name: "imageChunksHardVersioned",
  buildStart(): void {
    const generateHash = (filePath: string): string => {
      const fileBuffer = fs.readFileSync(filePath);
      return crypto.createHash("sha256").update(fileBuffer).digest("hex").substring(0, 6);
    };

    const allItemIcons = fs.globSync("resources/assets/item-icons/*.webp");

    const iconChunks: Record<string, Record<string, string>> = {};
    const iconNameRegex = /^[0-9]*$/;

    fs.rmSync("public/item-icons", { recursive: true, force: true });
    for (const inPath of allItemIcons) {
      const { name } = path.parse(inPath);
      if (!iconNameRegex.test(name)) {
        console.warn(`Invalid item icon file at '${inPath}'`);
      }

      const itemId = parseInt(name);
      const chunkIndex = Math.floor(itemId / 1000);
      const chunkKey = `icons-${chunkIndex}`;
      iconChunks[chunkKey] ??= {};
      const chunk = iconChunks[chunkKey];
      const hash = generateHash(inPath);

      const unresolvedPath = path.join("item-icons", `${name}.webp`).replace("\\", "/");
      const resolvedPath = path.join("item-icons", `${name}-${hash}.webp`).replace("\\", "/");

      chunk["/" + unresolvedPath] = "/" + resolvedPath;

      fs.cpSync(inPath, path.join("public", resolvedPath));
    }

    const iconChunkDir = "resources/assets/item-icons-chunks";
    fs.rmSync(iconChunkDir, { recursive: true, force: true });
    fs.mkdirSync(iconChunkDir);

    for (const [chunkName, chunkData] of Object.entries(iconChunks)) {
      if (Object.keys(chunkData).length > 0) {
        const chunkPath = path.join(iconChunkDir, `${chunkName}.json`);
        fs.writeFileSync(chunkPath, JSON.stringify(chunkData, Object.keys(chunkData).sort()));
      }
    }
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

const versionedAssetsPlugin = (
  configs: { inputResourcesDir: string; outputPublicDir: string; manifestKey: string }[],
): PluginOption => {
  const manifestByKey: Partial<Record<string, Partial<Record<string, string>>>> = {};

  return {
    name: "versionedAssets",
    buildStart(): void {
      const keyRegex = /^[a-z][a-z0-9-]*$/;

      for (const { inputResourcesDir, outputPublicDir, manifestKey } of configs) {
        if (!keyRegex.test(manifestKey)) {
          console.error(`Invalid manifest key ${manifestKey}.`);
          continue;
        }

        fs.rmSync(path.join("public", outputPublicDir), { recursive: true, force: true });

        const manifest: Partial<Record<string, string>> = {};
        manifestByKey[manifestKey] = manifest;

        const glob = path.join("resources", inputResourcesDir, "**/*.json");
        for (const inPath of fs.globSync(glob)) {
          const { dir, name } = path.parse(path.relative("resources/assets/data", inPath));

          const fileBuffer = fs.readFileSync(inPath);
          const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex").substring(0, 6);
          const outPath = path.join("public", outputPublicDir, dir, `${name}-${hash}.json`);

          const unresolvedPath = path.relative("resources/assets", inPath).replace("\\", "/");
          const resolvedPath = path.relative("public", outPath).replace("\\", "/");
          manifest["/" + unresolvedPath] = "/" + resolvedPath;

          fs.cpSync(inPath, outPath);
        }
      }
    },
    resolveId(source): string | null {
      if (!source.startsWith("@manifests/")) return null;

      return source;
    },
    load(id): string | null {
      if (!id.startsWith("@manifests/")) return null;

      const idRegex = /^@manifests\/(?<key>[a-z][a-z0-9-]*)$/;

      const key = idRegex.exec(id)?.groups?.key;
      if (!key) {
        console.error(`Invalid name ${id} for imported manifest, skipping it.`);
        return null;
      }

      const manifest = manifestByKey[key];
      if (!manifest) {
        console.error(`No manifest pre-generated for ${id}, skipping it.`);
        return null;
      }

      const module = `export default ${JSON.stringify(manifest, null, 2)};`;

      return module;
    },
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    imageChunksPlugin(),
    imageChunksHardVersionedPlugin(),
    versionedAssetsPlugin([
      { inputResourcesDir: "assets/data", outputPublicDir: "data", manifestKey: "data" },
      {
        inputResourcesDir: "assets/item-icons-chunks",
        outputPublicDir: "item-icons-chunks",
        manifestKey: "item-icons-chunks",
      },
    ]),
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
