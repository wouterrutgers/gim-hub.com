import * as z from "zod/v4";
import * as Member from "../../game/member";
import type { GroupCredentials } from "../credentials";

export type Response = z.infer<typeof CreateGroupResponseSchema>;

export const fetchCreateGroup = (groupName: string, memberNames: Member.Name[]): Promise<GroupCredentials> => {
  const url = `${__API_URL__}/create-group`;
  return fetch(url, {
    body: JSON.stringify({ name: groupName, member_names: memberNames }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("CreateGroup HTTP response was not OK");
      }

      return response.json();
    })
    .then((json) => {
      return CreateGroupResponseSchema.safeParseAsync(json);
    })
    .then((parseResult) => {
      if (!parseResult?.success) {
        throw new Error("CreateGroup response payload was malformed.", { cause: parseResult.error });
      }

      return parseResult.data;
    });
};

const CreateGroupResponseSchema = z
  .object({
    name: z.string(),
    token: z.string(),
  })
  .transform((credentials) => credentials as GroupCredentials);
