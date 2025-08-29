import z from "zod/v4";
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
  if (!res.ok) throw new Error("hiscores HTTP response was not OK");
  const json: unknown = await res.json();
  const parsed = await HiscoresSchema.safeParseAsync(json);
  if (!parsed.success) throw new Error("hiscores response payload was malformed.", { cause: parsed.error });
  return parsed.data;
};
