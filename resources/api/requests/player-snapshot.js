import * as z from "zod/v4";
import { canonicalizeCollectionLogItemId } from "../../game/collection-log";
import { diariesSchema } from "./group-data";
import { request } from "../request";

function emptyArrayToRecord(value) {
  if (Array.isArray(value) && value.length === 0) {
    return {};
  }
  return value;
}
const collectionSchema = z
  .preprocess(emptyArrayToRecord, z.record(z.string(), z.number()))
  .transform(function canonicalizeCollection(collection) {
    const canonicalCollection = {};

    for (const [itemId, quantity] of Object.entries(collection)) {
      const numericItemId = Number(itemId);

      if (!Number.isFinite(numericItemId)) {
        continue;
      }

      const canonicalItemId = String(canonicalizeCollectionLogItemId(numericItemId));
      const previousQuantity = canonicalCollection[canonicalItemId];
      canonicalCollection[canonicalItemId] =
        previousQuantity === undefined ? quantity : Math.max(previousQuantity, quantity);
    }

    return canonicalCollection;
  });
const bossKillCountSchema = z.preprocess(emptyArrayToRecord, z.record(z.string(), z.number()));
const playerSnapshotSchema = z.object({
  timestamp: z.number(),
  skills: z.record(z.string(), z.number()),
  quests: z.record(z.string(), z.string()),
  diaries: z.record(z.string(), z.record(z.string(), z.array(z.boolean()))).or(diariesSchema),
  collection: collectionSchema,
  bossKc: bossKillCountSchema.optional(),
});
const playerSnapshotsSchema = z
  .preprocess(
    function normalizeSnapshots(value) {
      if (Array.isArray(value) && value.length === 0) {
        return {};
      }

      return value;
    },
    z.record(
      z.string(),
      z.object({
        lastVisit: playerSnapshotSchema,
        lastWeek: playerSnapshotSchema,
      }),
    ),
  )
  .transform(function mapSnapshots(snapshots) {
    return new Map(Object.entries(snapshots));
  });

export async function fetchMemberSnapshots({ baseURL, credentials, markers }) {
  const searchParameters = new URLSearchParams();

  for (const [member, timestamp] of Object.entries(markers)) {
    searchParameters.set(`markers[${member}]`, String(timestamp));
  }

  const query = searchParameters.size > 0 ? `?${searchParameters.toString()}` : "";
  const response = await fetch(`${baseURL}/group/${credentials.name}/snapshots${query}`, {
    headers: {
      Authorization: credentials.token,
    },
  });

  if (!response.ok) {
    throw new Error("snapshots HTTP response was not OK");
  }

  return playerSnapshotsSchema.parseAsync(await response.json());
}

export async function createMemberSnapshot({ baseURL, credentials, member }) {
  const response = await request(`${baseURL}/group/${credentials.name}/snapshots`, {
    body: JSON.stringify({
      name: member,
    }),
    headers: {
      "Content-Type": "application/json",
      Authorization: credentials.token,
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("createMemberSnapshot HTTP response was not OK");
  }

  return playerSnapshotSchema.parseAsync(await response.json());
}
