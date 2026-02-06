import * as z from "zod/v4";
import type { GroupCredentials } from "../credentials";

export type Response = z.infer<typeof HiscoresSchema>;

const HiscoresSchema = z
  .record(
    z.string(),
    z.coerce
      .number()
      .int()
      .transform((n) => (Number.isFinite(n) && n > 0 ? n : 0)),
  )
  .transform((rec) => new Map<string, number>(Object.entries(rec)));

export const fetchMemberHiscores = async ({
  baseURL,
  credentials,
  memberName,
}: {
  baseURL: string;
  credentials: GroupCredentials;
  memberName: string;
}): Promise<Response> => {
  const url = `${baseURL}/group/${credentials.name}/hiscores?name=${encodeURIComponent(memberName)}`;
  const res = await fetch(url, { headers: { Authorization: credentials.token } });

  const json: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    const errorField = json && typeof json === "object" ? (json as { error?: unknown }).error : undefined;
    const message = typeof errorField === "string" ? errorField : `Failed to fetch hiscores (HTTP ${res.status})`;

    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const parsed = await HiscoresSchema.safeParseAsync(json);
  if (!parsed.success) throw new Error("hiscores response payload was malformed.", { cause: parsed.error });
  return parsed.data;
};
