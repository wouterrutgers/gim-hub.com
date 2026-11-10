import * as z from "zod/v4";

const activitySchema = z.object({
  id: z.number().int().positive(),
  member_id: z.number().int().positive(),
  revision: z.number().int().positive(),
  type: z.enum(["xp", "level", "boss", "quest", "diary", "loot", "collection"]),
  started_at: z.number().int().positive(),
  occurred_at: z.number().int().positive(),
  is_weekly: z.boolean(),
  data: z.record(z.string(), z.unknown()),
});
const responseSchema = z.object({
  entries: z.array(activitySchema),
  older_cursor: z.string().nullable().optional(),
  from_time: z.string(),
});
const playerResponseSchema = z.object({
  periods: z.array(
    z.object({
      key: z.string(),
      kind: z.enum(["day", "week"]),
      started_at: z.number().int(),
      ended_at: z.number().int(),
      entries: z.array(activitySchema),
    }),
  ),
  older_cursor: z.string().nullable().optional(),
  from_time: z.string(),
});

export async function fetchPlayerActivity({ baseURL, credentials, memberIdentifier, timezone, fromTime, cursor }) {
  const parameters = new URLSearchParams({ timezone });

  if (fromTime) {
    parameters.set("from_time", fromTime);
  }

  if (cursor) {
    parameters.set("cursor", cursor);
  }

  const response = await fetch(
    `${baseURL}/group/${credentials.name}/activity/player/${memberIdentifier}?${parameters}`,
    {
      headers: { Authorization: credentials.token },
    },
  );

  if (!response.ok) {
    throw new Error("Could not load player activity.");
  }

  return playerResponseSchema.parse(await response.json());
}

export async function fetchActivity({ baseURL, credentials, fromTime, cursor }) {
  const parameters = new URLSearchParams();

  if (fromTime) {
    parameters.set("from_time", fromTime);
  }

  if (cursor) {
    parameters.set("cursor", cursor);
  }

  const response = await fetch(`${baseURL}/group/${credentials.name}/activity?${parameters}`, {
    headers: { Authorization: credentials.token },
  });

  if (!response.ok) {
    throw new Error("Could not load group activity.");
  }

  return responseSchema.parse(await response.json());
}
