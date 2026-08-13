import * as z from "zod/v4";
import { canonicalizeCollectionLogItemId } from "../../game/collection-log";

const memberCollectionLogSchema = z.record(z.string(), z.uint32()).transform(function mapCollectionLog(items) {
  const collectionLog = new Map();

  for (const [itemId, quantity] of Object.entries(items)) {
    const numericItemId = Number(itemId);

    if (!Number.isFinite(numericItemId)) {
      continue;
    }

    const canonicalItemId = canonicalizeCollectionLogItemId(numericItemId);
    const previousQuantity = collectionLog.get(canonicalItemId) ?? 0;
    collectionLog.set(canonicalItemId, Math.max(previousQuantity, quantity));
  }

  return collectionLog;
});
const groupCollectionLogsSchema = z.preprocess(
  function normalizeEmptyCollectionLogs(collectionLogs) {
    return Array.isArray(collectionLogs) && collectionLogs.length === 0 ? {} : collectionLogs;
  },
  z.record(z.string(), memberCollectionLogSchema).transform(function mapGroupCollectionLogs(collectionLogs) {
    return new Map(Object.entries(collectionLogs));
  }),
);

export async function fetchGroupCollectionLogs({ baseURL, credentials }) {
  const response = await fetch(`${baseURL}/group/${credentials.name}/collection-log`, {
    headers: {
      Authorization: credentials.token,
    },
  });

  if (!response.ok) {
    throw new Error("Collection log HTTP response was not OK");
  }

  return groupCollectionLogsSchema.parseAsync(await response.json());
}
