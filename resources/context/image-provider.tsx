import { useMemo, useCallback, type ReactElement, type ReactNode } from "react";
import { ImageContext, type ImageContextValue } from "./image-context";
import { useImageChunks } from "../hooks/use-image-chunks";

export const ImageProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const { getImageUrl: getChunkedImageUrl, preloadMapRegion } = useImageChunks();

  const getImageUrlAsync = useCallback(
    async (path: string): Promise<string> => {
      return await getChunkedImageUrl(path);
    },
    [getChunkedImageUrl],
  );

  const contextValue: ImageContextValue = useMemo(
    () => ({
      getImageUrlAsync,
      preloadMapRegion,
    }),
    [getImageUrlAsync, preloadMapRegion],
  );

  return <ImageContext.Provider value={contextValue}>{children}</ImageContext.Provider>;
};
