import { defineStore } from "pinia";
import * as z from "zod/v4";
import rawImageChunksManifest from "@manifests/image-chunks";

const imageChunksManifest = z.record(z.string(), z.string()).parse(rawImageChunksManifest);

export const useImageStore = defineStore("images", function createImageStore() {
  const chunks = new Map();
  const loadingChunks = new Map();

  function getChunkUrl(imagePath) {
    if (imagePath.startsWith("/item-icons/")) {
      const match = /\/item-icons\/(?<itemID>[0-9]+)\.webp/.exec(imagePath);

      if (!match?.groups?.itemID) {
        return undefined;
      }

      const itemId = Number.parseInt(match.groups.itemID);

      return imageChunksManifest[`/image-chunks/items-${Math.floor(itemId / 1000)}.json`];
    }

    if (imagePath.startsWith("/map-tiles/")) {
      const match = /\/map-tiles\/(\d+)_(\d+)_(\d+)\.webp/.exec(imagePath);

      if (!match) {
        return undefined;
      }

      const [, zoom, x, y] = match.map(Number);

      return imageChunksManifest[`/image-chunks/map-${zoom}-${Math.floor(x / 20)}-${Math.floor(y / 20)}.json`];
    }

    for (const prefix of ["map-misc", "ui", "images", "icons"]) {
      if (imagePath.startsWith(`/${prefix}/`)) {
        return imageChunksManifest[`/image-chunks/${prefix}.json`];
      }
    }

    return imageChunksManifest["/image-chunks/misc.json"];
  }

  async function loadChunk(chunkUrl) {
    if (chunks.has(chunkUrl)) {
      return chunks.get(chunkUrl);
    }

    if (!loadingChunks.has(chunkUrl)) {
      loadingChunks.set(chunkUrl, fetchChunk(chunkUrl));
    }

    try {
      return await loadingChunks.get(chunkUrl);
    } finally {
      loadingChunks.delete(chunkUrl);
    }
  }

  async function fetchChunk(chunkUrl) {
    const response = await fetch(chunkUrl);

    if (!response.ok) {
      throw new Error(`Failed to load image chunk: ${chunkUrl}`);
    }

    const chunk = await response.json();
    chunks.set(chunkUrl, chunk);

    return chunk;
  }

  async function getImageUrl(imagePath) {
    const chunkUrl = getChunkUrl(imagePath);

    if (!chunkUrl) {
      return "";
    }

    return (await loadChunk(chunkUrl))[imagePath] ?? "";
  }

  return { getImageUrl };
});
