import * as z from "zod/v4";
import { fetchVersionedData } from "../api/fetch-versioned-data";

const mapDataSchema = z.object({
  icons: z.record(
    z.string(),
    z.record(
      z.string(),
      z.record(
        z.string(),
        z.array(z.int()).refine(function hasCoordinatePairs(coordinates) {
          return coordinates.length % 2 === 0;
        }),
      ),
    ),
  ),
  labels: z.record(
    z.string(),
    z.record(
      z.string(),
      z.record(
        z.string(),
        z.array(z.int()).refine(function hasCoordinateTriples(coordinates) {
          return coordinates.length % 3 === 0;
        }),
      ),
    ),
  ),
  tiles: z.array(z.array(z.int())).length(4),
});

export async function fetchMapData() {
  return mapDataSchema.parseAsync(await fetchVersionedData("/data/map.json"));
}
