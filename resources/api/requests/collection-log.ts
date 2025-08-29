import z from "zod/v4";
import type { ItemID } from "../../game/items";
import type { GroupCredentials } from "../credentials";
import * as Member from "../../game/member";
import { canonicalizeCollectionLogItemId } from "../../game/collection-log";

const MemberCollectionLogSchema = z.record(z.string(), z.uint32()).transform((itemsRecord) => {
  const obtained = new Map<ItemID, number>();
  Object.entries(itemsRecord).forEach(([idStr, quantity]) => {
    const idNum = Number(idStr);
    if (!Number.isFinite(idNum)) return;
    const canonical = canonicalizeCollectionLogItemId(idNum as ItemID);

    const prev = obtained.get(canonical) ?? 0;
    obtained.set(canonical, Math.max(prev, quantity));
  });
  return obtained;
});

const GroupCollectionLogsSchema = z.record(
  z.string().transform((name) => name as Member.Name),
  MemberCollectionLogSchema,
);
export type GroupResponse = z.infer<typeof GroupCollectionLogsSchema>;

export const fetchGroupCollectionLogs = ({
  baseURL,
  credentials,
}: {
  baseURL: string;
  credentials: GroupCredentials;
}): Promise<GroupResponse> =>
  fetch(`${baseURL}/group/${credentials.name}/collection-log`, {
    headers: { Authorization: credentials.token },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("collection-log HTTP response was not OK");
      }
      return response.json();
    })
    .then((json) => GroupCollectionLogsSchema.parseAsync(json));
