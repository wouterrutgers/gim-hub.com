import * as z from "zod/v4";
import manifestRaw from "@manifests/data";

const manifestSchema = z.partialRecord(z.string(), z.string());
const manifest = manifestSchema.parse(manifestRaw);

export const fetchVersionedJSON = (publicPath: string): Promise<unknown> => {
  const resolvedPath = manifest[publicPath];
  if (resolvedPath === undefined) {
    console.error("Unable to resolve versioned JSON asset from: " + publicPath);
    return Promise.resolve(undefined);
  }

  return fetch(resolvedPath).then((file) => file.json());
};
