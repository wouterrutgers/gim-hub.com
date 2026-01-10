import { useState, useCallback } from "react";
import itemIconsChunksRaw from "@manifests/item-icons-chunks";
import mapTilesChunksRaw from "@manifests/map-tiles-chunks";
import * as z from "zod/v4";

const ManifestSchema = z.record(z.string(), z.string());
const itemIconsChunks = ManifestSchema.parse(itemIconsChunksRaw);
const mapTilesChunks = ManifestSchema.parse(mapTilesChunksRaw);

type ImageChunk = Record<string, string>;

const imageChunkCache = new Map<string, ImageChunk>();
const loadingChunks = new Set<string>();

export const useImageChunks = (): {
  getImageUrl: (imagePath: string) => Promise<string>;
  preloadChunk: (chunkKey: string) => Promise<void>;
  preloadMapRegion: (x: number, y: number, z?: number) => Promise<void>;
  loadedChunks: Set<string>;
  getChunkKey: (imagePath: string) => string;
} => {
  const [loadedChunks, setLoadedChunks] = useState<Set<string>>(new Set());

  const getChunkKey = useCallback((imagePath: string): string => {
    if (imagePath.startsWith("/icons/")) {
      return "icons-misc";
    }

    if (imagePath.startsWith("/item-icons/")) {
      const match = /\/item-icons\/(?<itemID>[0-9]+)\.webp/.exec(imagePath);
      if (match?.groups?.itemID) {
        const itemId = Number.parseInt(match?.groups?.itemID);
        const chunkIndex = Math.floor(itemId / 1000);

        const unresolvedPath = `/item-icons-chunks/icons-${chunkIndex}.json`;
        const resolvedPath = itemIconsChunks[unresolvedPath];

        return resolvedPath;
      }

      return "icons-misc";
    }

    if (imagePath.startsWith("/map-tiles/")) {
      const match = /\/map-tiles\/(\d+)_(\d+)_(\d+)\.webp/.exec(imagePath);
      if (match?.length && match?.length === 4) {
        const [, z, x, y] = match.map(Number);
        const regionX = Math.floor(x / 20);
        const regionY = Math.floor(y / 20);

        const unresolvedPath = `/map-tiles-chunks/map-${z}-${regionX}-${regionY}.json`;
        const resolvedPath = mapTilesChunks[unresolvedPath];

        return resolvedPath;
      }

      return "map-misc";
    }

    if (imagePath.startsWith("/ui/")) {
      return "ui";
    }

    if (imagePath.startsWith("/map/")) {
      const match = /\/map\/(\d+)_(\d+)_(\d+)\.webp/.exec(imagePath);
      if (match) {
        const [, z, x, y] = match.map(Number);
        const regionX = Math.floor(x / 20);
        const regionY = Math.floor(y / 20);

        return `map-${z}-${regionX}-${regionY}`;
      }

      return "map-misc";
    }

    return "misc";
  }, []);

  const loadChunk = useCallback(async (chunkKey: string): Promise<ImageChunk> => {
    if (imageChunkCache.has(chunkKey)) {
      return imageChunkCache.get(chunkKey)!;
    }

    if (loadingChunks.has(chunkKey)) {
      while (loadingChunks.has(chunkKey)) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      return imageChunkCache.get(chunkKey) ?? {};
    }

    loadingChunks.add(chunkKey);

    try {
      const fetchURL = ((): string => {
        if (chunkKey.startsWith("/item-icons-chunks/") || chunkKey.startsWith("/map-tiles-chunks/")) {
          return chunkKey;
        }
        return `/image-chunks/${chunkKey}.json`;
      })();
      const response = await fetch(fetchURL);

      if (!response.ok) {
        throw new Error(`Failed to load image chunk: ${chunkKey}`);
      }

      const chunkData = (await response.json()) as ImageChunk;

      imageChunkCache.set(chunkKey, chunkData);
      setLoadedChunks((prev) => new Set([...prev, chunkKey]));

      return chunkData;
    } finally {
      loadingChunks.delete(chunkKey);
    }
  }, []);

  const getImageUrl = useCallback(
    async (path: string): Promise<string> => {
      const chunkKey = getChunkKey(path);
      const chunk = await loadChunk(chunkKey);
      const hash = chunk[path];

      if (hash.startsWith("/item-icons/") || hash.startsWith("/map-tiles/")) {
        return hash;
      }

      if (!hash) {
        return "";
      }

      return `${path}?v=${hash}`;
    },
    [getChunkKey, loadChunk],
  );

  const preloadChunk = useCallback(
    async (chunkKey: string): Promise<void> => {
      try {
        await loadChunk(chunkKey);
      } catch (error) {
        console.error(error);
      }
    },
    [loadChunk],
  );

  const preloadMapRegion = useCallback(
    async (x: number, y: number, z = 0): Promise<void> => {
      const regionX = Math.floor(x / 20);
      const regionY = Math.floor(y / 20);
      const chunkKey = `map-${z}-${regionX}-${regionY}`;
      await preloadChunk(chunkKey);
    },
    [preloadChunk],
  );

  return {
    getImageUrl,
    preloadChunk,
    preloadMapRegion,
    loadedChunks,
    getChunkKey,
  };
};
