import * as z from "zod/v4";
import rawManifest from "@manifests/data";

const manifest = z.partialRecord(z.string(), z.string()).parse(rawManifest);

export async function fetchVersionedData(publicPath) {
  const versionedPath = manifest[publicPath];

  if (versionedPath === undefined) {
    throw new Error(`Unable to resolve versioned data asset: ${publicPath}`);
  }

  const response = await fetch(versionedPath);

  if (!response.ok) {
    throw new Error(`Unable to fetch versioned data asset: ${publicPath}`);
  }

  return response.json();
}
