import { defineConfig, lazyPlugins } from "vite-plus";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import vue from "@vitejs/plugin-vue";
import laravel from "laravel-vite-plugin";

const PUBLIC_VERSIONED_ROOT = "public/hashed";
function makeVersionedPaths({ hash, name, fileExtensionWithPeriod: fileExtension, directoryRelative }) {
  return {
    unresolvedPath: "/" + path.join(directoryRelative, `${name}${fileExtension}`).replaceAll("\\", "/"),
    resolvedPath: "/" + path.join("hashed", directoryRelative, `${name}-${hash}${fileExtension}`).replaceAll("\\", "/"),
  };
}

async function generateHash(filePath) {
  const fileBuffer = await fs.promises.readFile(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex").substring(0, 6);
}

async function generateImageChunks() {
  console.info("Creating image chunks...");
  const startTime = performance.now();
  const chunksResourcesDir = "resources/assets/image-chunks";
  fs.rmSync(chunksResourcesDir, {
    recursive: true,
    force: true,
  });
  fs.mkdirSync(chunksResourcesDir);
  const concurrentLimit = 2000;
  {
    const allItemIcons = fs.globSync("resources/assets/item-icons/*.webp");
    fs.mkdirSync(path.join(PUBLIC_VERSIONED_ROOT, "item-icons"));
    const iconChunks = {};
    const iconNameRegex = /^[0-9]*$/;
    for (let i = 0; i < allItemIcons.length; i += concurrentLimit) {
      const p = [];
      for (const inPath of allItemIcons.slice(i, i + concurrentLimit)) {
        p.push(
          generateHash(inPath).then((hash) => {
            const { name } = path.parse(inPath);
            if (!iconNameRegex.test(name)) {
              console.warn(`Invalid item icon file at '${inPath}'`);
              return Promise.resolve();
            }
            const itemId = parseInt(name);
            const chunkIndex = Math.floor(itemId / 1000);
            const chunkKey = `items-${chunkIndex}`;
            iconChunks[chunkKey] ??= {};
            const chunk = iconChunks[chunkKey];
            const { unresolvedPath, resolvedPath } = makeVersionedPaths({
              hash,
              name,
              fileExtensionWithPeriod: ".webp",
              directoryRelative: "item-icons",
            });
            chunk[unresolvedPath] = resolvedPath;
            return fs.promises.copyFile(inPath, path.join("public", resolvedPath));
          }),
        );
      }
      await Promise.all(p);
    }
    const p = [];
    for (const [chunkName, chunkData] of Object.entries(iconChunks)) {
      if (Object.keys(chunkData).length > 0) {
        const chunkPath = path.join(chunksResourcesDir, `${chunkName}.json`);
        p.push(fs.promises.writeFile(chunkPath, JSON.stringify(chunkData, Object.keys(chunkData).sort())));
      }
    }
    await Promise.all(p);
  }
  {
    const allMapTiles = fs.globSync("resources/assets/map-tiles/*.webp");
    const tileChunks = {};
    const tileNameRegex = /^(\d+)_(\d+)_(\d+)$/;
    fs.mkdirSync(path.join(PUBLIC_VERSIONED_ROOT, "map-tiles"));
    for (let i = 0; i < allMapTiles.length; i += concurrentLimit) {
      const p = [];
      for (const inPath of allMapTiles.slice(i, i + concurrentLimit)) {
        p.push(
          generateHash(inPath).then((hash) => {
            const { name } = path.parse(inPath);
            const match = tileNameRegex.exec(name);
            if (!match) {
              console.warn(`Invalid map tile file at '${inPath}'`);
              return Promise.resolve();
            }
            const [, z, x, y] = match.map(Number);
            const regionX = Math.floor(x / 20);
            const regionY = Math.floor(y / 20);
            const chunkKey = `map-${z}-${regionX}-${regionY}`;
            tileChunks[chunkKey] ??= {};
            const chunk = tileChunks[chunkKey];
            const { unresolvedPath, resolvedPath } = makeVersionedPaths({
              hash,
              name,
              fileExtensionWithPeriod: ".webp",
              directoryRelative: "map-tiles",
            });
            chunk[unresolvedPath] = resolvedPath;
            return fs.promises.copyFile(inPath, path.join("public", resolvedPath));
          }),
        );
      }
      await Promise.all(p);
    }
    const p = [];
    for (const [chunkName, chunkData] of Object.entries(tileChunks)) {
      if (Object.keys(chunkData).length > 0) {
        const chunkPath = path.join(chunksResourcesDir, `${chunkName}.json`);
        p.push(fs.promises.writeFile(chunkPath, JSON.stringify(chunkData, Object.keys(chunkData).sort())));
      }
    }
    await Promise.all(p);
  }
  for (const assetsSubDir of ["map-misc", "ui", "images", "icons"]) {
    const allImages = fs.globSync(`resources/assets/${assetsSubDir}/*.*`);
    fs.mkdirSync(path.join(PUBLIC_VERSIONED_ROOT, assetsSubDir));
    const chunk = {};
    for (let i = 0; i < allImages.length; i += concurrentLimit) {
      const p = [];
      for (const inPath of allImages.slice(i, i + concurrentLimit)) {
        p.push(
          generateHash(inPath).then((hash) => {
            const { name, ext } = path.parse(inPath);
            const isImage = [".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg"].includes(ext);
            if (!isImage) {
              console.warn(`Invalid non-image found at ${inPath}`);
              return Promise.resolve();
            }
            const { unresolvedPath, resolvedPath } = makeVersionedPaths({
              hash,
              name,
              fileExtensionWithPeriod: ext,
              directoryRelative: assetsSubDir,
            });
            chunk[unresolvedPath] = resolvedPath;
            return fs.promises.copyFile(inPath, path.join("public", resolvedPath));
          }),
        );
      }
      await Promise.all(p);
    }
    if (Object.keys(chunk).length > 0) {
      const chunkPath = path.join(chunksResourcesDir, `${assetsSubDir}.json`);
      fs.writeFileSync(chunkPath, JSON.stringify(chunk, Object.keys(chunk).sort()));
    }
  }
  console.info(
    `Finished generating image chunks in ${((performance.now() - startTime) / 1000).toLocaleString()} seconds.`,
  );
}

async function generateVersionedJson(allManifestKeys) {
  const manifestByKey = {};
  const keyRegex = /^[a-z][a-z0-9-]*$/;
  for (const manifestKey of allManifestKeys) {
    if (!keyRegex.test(manifestKey)) {
      console.error(`Invalid manifest key ${manifestKey}.`);
      continue;
    }
    const assetsSubDir = manifestKey;
    fs.rmSync(path.join(PUBLIC_VERSIONED_ROOT, assetsSubDir), {
      recursive: true,
      force: true,
    });
    const manifest = {};
    manifestByKey[manifestKey] = manifest;
    const glob = path.join("resources/assets", assetsSubDir, "**/*.json");
    for (const inPath of fs.globSync(glob)) {
      const { name } = path.parse(path.relative(`resources/assets/${assetsSubDir}`, inPath));
      const hash = await generateHash(inPath);
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
  return manifestByKey;
}

function assetsPlugin(allManifestKeys) {
  const manifestByKey = {};
  return {
    name: "assetsPlugin",
    async buildStart() {
      fs.rmSync(PUBLIC_VERSIONED_ROOT, {
        recursive: true,
        force: true,
      });
      fs.mkdirSync(PUBLIC_VERSIONED_ROOT);
      await generateImageChunks();
      Object.assign(manifestByKey, await generateVersionedJson(allManifestKeys));
    },
    resolveId(source) {
      if (!source.startsWith("@manifests/")) return null;
      return source;
    },
    load(id) {
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
}
export default defineConfig({
  lint: {
    plugins: ["vue"],
    categories: {
      correctness: "error",
    },
    ignorePatterns: ["cache", "resources/js/check-collection-log-mappings.js", "resources/js/quests"],
    rules: {
      "no-useless-rename": "off",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_[^_].*$|^_$",
          varsIgnorePattern: "^_[^_].*$|^_$",
          caughtErrorsIgnorePattern: "^_[^_].*$|^_$",
        },
      ],
      "no-console": [
        "error",
        {
          allow: ["warn", "error", "info", "groupCollapsed", "groupEnd"],
        },
      ],
    },
    overrides: [
      {
        files: ["resources/**/*.{js,vue}"],
        env: {
          browser: true,
        },
      },
    ],
  },
  fmt: {
    tabWidth: 2,
    semi: true,
    printWidth: 120,
    endOfLine: "lf",
    sortPackageJson: true,
    vueIndentScriptAndStyle: true,
  },
  plugins: lazyPlugins(() => [
    assetsPlugin(["data", "image-chunks"]),
    vue({
      template: {
        transformAssetUrls: {
          base: null,
          includeAbsolute: false,
        },
      },
    }),
    laravel({
      input: ["resources/views/index.js"],
      refresh: true,
    }),
  ]),
  define: {
    __API_URL__: "'/api'",
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes("/node_modules/")) return undefined;
          if (
            id.includes("/node_modules/vue/") ||
            id.includes("/node_modules/vue-router/") ||
            id.includes("/node_modules/pinia/")
          ) {
            return "vendor-vue";
          }
          if (
            id.includes("/node_modules/chart.js/") ||
            id.includes("/node_modules/vue-chartjs/") ||
            id.includes("/node_modules/chartjs-adapter-date-fns/")
          ) {
            return "vendor-chart";
          }
          if (id.includes("/node_modules/date-fns/") || id.includes("/node_modules/@date-fns/")) {
            return "vendor-date";
          }
          if (id.includes("/node_modules/zod/")) {
            return "vendor-zod";
          }
          return undefined;
        },
      },
    },
  },
});
