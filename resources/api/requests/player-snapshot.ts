import * as z from "zod/v4";
import type * as Member from "../../game/member";
import { canonicalizeCollectionLogItemId } from "../../game/collection-log";
import type { ItemID } from "../../game/items";
import type { PlayerSnapshot } from "../../hooks/player-snapshot";
import type { GroupCredentials } from "../credentials";
import { DiariesSchema } from "./group-data";

export type { PlayerSnapshot } from "../../hooks/player-snapshot";

export interface MemberSnapshotBaselines {
  lastVisit: PlayerSnapshot;
  lastWeek: PlayerSnapshot;
}

export type SnapshotMarkers = Record<string, number>;
export type Response = Map<Member.Name, MemberSnapshotBaselines>;

function emptyArrayToRecord(value: unknown): unknown {
  if (Array.isArray(value) && value.length === 0) {
    return {};
  }

  return value;
}

const CollectionSchema = z
  .preprocess(emptyArrayToRecord, z.record(z.string(), z.number()))
  .transform((collection): Record<string, number> => {
    const canonicalCollection: Record<string, number> = {};

    for (const [itemId, quantity] of Object.entries(collection)) {
      const numericItemId = Number(itemId);
      if (!Number.isFinite(numericItemId)) continue;

      const canonicalItemId = String(canonicalizeCollectionLogItemId(numericItemId as ItemID));
      const previousQuantity = canonicalCollection[canonicalItemId];
      canonicalCollection[canonicalItemId] =
        previousQuantity === undefined ? quantity : Math.max(previousQuantity, quantity);
    }

    return canonicalCollection;
  });

const BossKcSchema = z.preprocess(emptyArrayToRecord, z.record(z.string(), z.number()));

const PlayerSnapshotSchema = z
  .object({
    timestamp: z.number(),
    skills: z.record(z.string(), z.number()),
    quests: z.record(z.string(), z.string()),
    diaries: z.record(z.string(), z.record(z.string(), z.array(z.boolean()))).or(DiariesSchema),
    collection: CollectionSchema,
    bossKc: BossKcSchema.optional(),
  })
  .transform((snapshot) => snapshot as PlayerSnapshot);

const PlayerSnapshotsSchema = z
  .preprocess(
    (value) => {
      if (Array.isArray(value) && value.length === 0) {
        return {};
      }

      return value;
    },
    z.record(
      z.string(),
      z.object({
        lastVisit: PlayerSnapshotSchema,
        lastWeek: PlayerSnapshotSchema,
      }),
    ),
  )
  .transform(
    (snapshots) => new Map(Object.entries(snapshots).map(([member, baselines]) => [member as Member.Name, baselines])),
  );

export function fetchMemberSnapshots({
  baseURL,
  credentials,
  markers,
}: {
  baseURL: string;
  credentials: GroupCredentials;
  markers: SnapshotMarkers;
}): Promise<Response> {
  const searchParameters = new URLSearchParams();
  for (const [member, timestamp] of Object.entries(markers)) {
    searchParameters.set(`markers[${member}]`, String(timestamp));
  }

  const query = searchParameters.size > 0 ? `?${searchParameters.toString()}` : "";

  return fetch(`${baseURL}/group/${credentials.name}/snapshots${query}`, {
    headers: { Authorization: credentials.token },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("snapshots HTTP response was not OK");
      }

      return response.json();
    })
    .then((json) => PlayerSnapshotsSchema.parseAsync(json));
}

export function createMemberSnapshot({
  baseURL,
  credentials,
  member,
}: {
  baseURL: string;
  credentials: GroupCredentials;
  member: Member.Name;
}): Promise<PlayerSnapshot> {
  return fetch(`${baseURL}/group/${credentials.name}/snapshots`, {
    body: JSON.stringify({ name: member }),
    headers: {
      "Content-Type": "application/json",
      Authorization: credentials.token,
    },
    method: "POST",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("createMemberSnapshot HTTP response was not OK");
      }

      return response.json();
    })
    .then((json) => PlayerSnapshotSchema.parseAsync(json));
}
