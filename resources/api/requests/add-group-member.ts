import * as Member from "../../game/member";
import type { GroupCredentials } from "../credentials";

export type Response = { status: "ok" } | { status: "error"; text: string };

export const addGroupMember = ({
  baseURL,
  credentials,
  member,
}: {
  baseURL: string;
  credentials: GroupCredentials;
  member: Member.Name;
}): Promise<Response> =>
  fetch(`${baseURL}/group/${credentials.name}/add-group-member`, {
    body: JSON.stringify({ name: member }),
    headers: {
      "Content-Type": "application/json",
      Authorization: credentials.token,
    },
    method: "POST",
  }).then((response) => {
    if (response.status === 400) {
      return response
        .json()
        .then(
          (json) => (json as { error?: string }).error ?? "Unknown server error.",
          (reason) => {
            console.error("addGroupMember failed to parse response JSON:", reason);
            return "Unknown server error.";
          },
        )
        .then((text) => ({ status: "error", text }));
    }

    if (!response.ok && response.status !== 400) {
      throw new Error("addGroupMember HTTP response was not OK");
    }

    return { status: "ok" };
  });
