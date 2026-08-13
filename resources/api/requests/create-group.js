import * as z from "zod/v4";
import { request } from "../request";

const credentialsSchema = z.object({
  name: z.string(),
  token: z.string(),
});

export async function fetchCreateGroup(groupName, memberNames) {
  const url = `${__API_URL__}/create-group`;
  const response = await request(url, {
    body: JSON.stringify({
      name: groupName,
      member_names: memberNames,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("CreateGroup HTTP response was not OK");
  }

  return credentialsSchema.parseAsync(await response.json());
}
