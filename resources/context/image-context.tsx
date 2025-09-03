import { createContext, useContext } from "react";

export interface ImageContextValue {
  getImageUrlAsync: (path: string) => Promise<string>;
  preloadMapRegion?: (z: number, x: number, y: number) => void;
}

export const ImageContext = createContext<ImageContextValue | null>(null);

export const useImageContext = (): ImageContextValue => {
  return useContext(ImageContext)!;
};
