import { useState, useCallback } from "react";

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
      const match = /\/icons\/items\/(\d+)\.webp/.exec(imagePath);
      if (match) {
        const itemId = parseInt(match[1], 10);
        const chunkIndex = Math.floor(itemId / 1000);

        return `icons-${chunkIndex}`;
      }

      return "icons-misc";
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
      const response = await fetch(`/image-chunks/${chunkKey}.json`);

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
