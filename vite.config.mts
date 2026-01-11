import { defineConfig, type PluginOption } from "vite";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import react from "@vitejs/plugin-react";
import laravel from "laravel-vite-plugin";

// The directory to store all generated hashed files in. We append a hash to their filename for cache busting.
const PUBLIC_VERSIONED_ROOT = "public/hashed";
fs.rmSync(PUBLIC_VERSIONED_ROOT, { recursive: true, force: true });
fs.mkdirSync(PUBLIC_VERSIONED_ROOT);

const makeVersionedPaths = ({
  hash,
  name,
  fileExtensionWithPeriod: fileExtension,
  directoryRelative,
}: {
  hash: string;
  name: string;
  fileExtensionWithPeriod: string;
  directoryRelative: string;
}): { unresolvedPath: string; resolvedPath: string } => {
  return {
    unresolvedPath: "/" + path.join(directoryRelative, `${name}${fileExtension}`).replaceAll("\\", "/"),
    resolvedPath: "/" + path.join("hashed", directoryRelative, `${name}-${hash}${fileExtension}`).replaceAll("\\", "/"),
  };
};

const generateHash = (filePath: string): string => {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex").substring(0, 6);
};

const imageChunksPlugin = (): PluginOption => ({
  name: "imageChunksHardVersioned",
  buildStart(): void {
    console.info("Scanning public directory and creating hard versioned image chunks...");

    const chunksResourcesDir = "resources/assets/image-chunks";
    fs.rmSync(chunksResourcesDir, { recursive: true, force: true });
    fs.mkdirSync(chunksResourcesDir);

    {
      const allItemIcons = fs.globSync("resources/assets/item-icons/*.webp");

      const iconChunks: Record<string, Record<string, string>> = {};
      const iconNameRegex = /^[0-9]*$/;

      fs.rmSync(path.join(PUBLIC_VERSIONED_ROOT, "item-icons"), { recursive: true, force: true });
      for (const inPath of allItemIcons) {
        const { name } = path.parse(inPath);
        if (!iconNameRegex.test(name)) {
          console.warn(`Invalid item icon file at '${inPath}'`);
        }

        const itemId = parseInt(name);
        const chunkIndex = Math.floor(itemId / 1000);
        const chunkKey = `items-${chunkIndex}`;
        iconChunks[chunkKey] ??= {};
        const chunk = iconChunks[chunkKey];
        const hash = generateHash(inPath);

        const { unresolvedPath, resolvedPath } = makeVersionedPaths({
          hash,
          name,
          fileExtensionWithPeriod: ".webp",
          directoryRelative: "item-icons",
        });
        chunk[unresolvedPath] = resolvedPath;

        fs.cpSync(inPath, path.join("public", resolvedPath));
      }

      for (const [chunkName, chunkData] of Object.entries(iconChunks)) {
        if (Object.keys(chunkData).length > 0) {
          const chunkPath = path.join(chunksResourcesDir, `${chunkName}.json`);
          fs.writeFileSync(chunkPath, JSON.stringify(chunkData, Object.keys(chunkData).sort()));
        }
      }
    }

    {
      const allMapTiles = fs.globSync("resources/assets/map-tiles/*.webp");

      const tileChunks: Record<string, Record<string, string>> = {};
      const tileNameRegex = /^(\d+)_(\d+)_(\d+)$/;

      fs.rmSync(path.join(PUBLIC_VERSIONED_ROOT, "map-tiles"), { recursive: true, force: true });
      for (const inPath of allMapTiles) {
        const { name } = path.parse(inPath);
        const match = tileNameRegex.exec(name);
        if (!match) {
          console.warn(`Invalid map tile file at '${inPath}'`);
          continue;
        }
        const [, z, x, y] = match.map(Number);
        const regionX = Math.floor(x / 20);
        const regionY = Math.floor(y / 20);
        const chunkKey = `map-${z}-${regionX}-${regionY}`;
        tileChunks[chunkKey] ??= {};
        const chunk = tileChunks[chunkKey];
        const hash = generateHash(inPath);

        const { unresolvedPath, resolvedPath } = makeVersionedPaths({
          hash,
          name,
          fileExtensionWithPeriod: ".webp",
          directoryRelative: "map-tiles",
        });
        chunk[unresolvedPath] = resolvedPath;

        fs.cpSync(inPath, path.join("public", resolvedPath));
      }

      for (const [chunkName, chunkData] of Object.entries(tileChunks)) {
        if (Object.keys(chunkData).length > 0) {
          const chunkPath = path.join(chunksResourcesDir, `${chunkName}.json`);
          fs.writeFileSync(chunkPath, JSON.stringify(chunkData, Object.keys(chunkData).sort()));
        }
      }
    }

    for (const assetsSubDir of ["map-misc", "ui", "images", "icons"]) {
      const allImages = fs.globSync(`resources/assets/${assetsSubDir}/*.*`);

      const chunk: Record<string, string> = {};

      fs.rmSync(path.join(PUBLIC_VERSIONED_ROOT, assetsSubDir), { recursive: true, force: true });
      for (const inPath of allImages) {
        const { name, ext } = path.parse(inPath);
        const isImage = [".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg"].includes(ext);
        if (!isImage) continue;

        const hash = generateHash(inPath);

        const { unresolvedPath, resolvedPath } = makeVersionedPaths({
          hash,
          name,
          fileExtensionWithPeriod: ext,
          directoryRelative: assetsSubDir,
        });
        chunk[unresolvedPath] = resolvedPath;

        fs.cpSync(inPath, path.join("public", resolvedPath));
      }

      if (Object.keys(chunk).length > 0) {
        const chunkPath = path.join(chunksResourcesDir, `${assetsSubDir}.json`);
        fs.writeFileSync(chunkPath, JSON.stringify(chunk, Object.keys(chunk).sort()));
      }
    }
  },
});

const versionedJsonPlugin = (configs: string[]): PluginOption => {
  const manifestByKey: Partial<Record<string, Partial<Record<string, string>>>> = {};

  return {
    name: "versionedJson",
    buildStart(): void {
      const keyRegex = /^[a-z][a-z0-9-]*$/;

      for (const manifestKey of configs) {
        if (!keyRegex.test(manifestKey)) {
          console.error(`Invalid manifest key ${manifestKey}.`);
          continue;
        }

        const assetsSubDir = manifestKey;

        fs.rmSync(path.join(PUBLIC_VERSIONED_ROOT, assetsSubDir), { recursive: true, force: true });

        const manifest: Partial<Record<string, string>> = {};
        manifestByKey[manifestKey] = manifest;

        const glob = path.join("resources/assets", assetsSubDir, "**/*.json");
        for (const inPath of fs.globSync(glob)) {
          const { name } = path.parse(path.relative(`resources/assets/${assetsSubDir}`, inPath));

          const hash = generateHash(inPath);

          const { unresolvedPath, resolvedPath } = makeVersionedPaths({
            hash,
            name,
            fileExtensionWithPeriod: ".json",
            directoryRelative: assetsSubDir,
          });
          manifest[unresolvedPath] = resolvedPath;

          fs.cpSync(inPath, path.join("public", resolvedPath));
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
    versionedJsonPlugin(["data", "image-chunks"]),
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
