import * as z from "zod/v4";

const hiscoresSchema = z
  .record(
    z.string(),
    z.coerce
      .number()
      .int()
      .transform(function normalizeKillCount(killCount) {
        return Number.isFinite(killCount) && killCount > 0 ? killCount : 0;
      }),
  )
  .transform(function mapHiscores(hiscores) {
    return new Map(Object.entries(hiscores));
  });

export async function fetchMemberHiscores({ baseURL, credentials, memberName }) {
  const url = `${baseURL}/group/${credentials.name}/hiscores?name=${encodeURIComponent(memberName)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: credentials.token,
    },
  });
  const json = await res.json().catch(() => undefined);
  if (!res.ok) {
    const errorField = json && typeof json === "object" ? json.error : undefined;
    const message = typeof errorField === "string" ? errorField : `Failed to fetch hiscores (HTTP ${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return hiscoresSchema.parseAsync(json);
}
