import * as Member from "../../game/member";
import type { GroupCredentials } from "../credentials";

export type ColorUpdate = { name: string; color_hue_degrees: number };

export type Response =
  | { status: "ok"; updated: ColorUpdate; swapped?: ColorUpdate }
  | { status: "error"; text: string };

export const updateMemberColor = ({
  baseURL,
  credentials,
  name,
  colorHueDegrees,
}: {
  baseURL: string;
  credentials: GroupCredentials;
  name: Member.Name;
  colorHueDegrees: number;
}): Promise<Response> =>
  fetch(`${baseURL}/group/${credentials.name}/update-member-color`, {
    body: JSON.stringify({ name: name, color_hue_degrees: colorHueDegrees }),
    headers: {
      "Content-Type": "application/json",
      Authorization: credentials.token,
    },
    method: "PUT",
  }).then((response): Promise<Response> => {
    if (response.status === 400) {
      return response
        .json()
        .then(
          (json) => (json as { error?: string }).error ?? "Unknown server error.",
          (reason) => {
            console.error("updateMemberColor failed to parse response JSON:", reason);
            return "Unknown server error.";
          },
        )
        .then((text) => ({ status: "error", text }));
    }

    if (response.status === 404) {
      return Promise.resolve({ status: "error", text: "Member not found." });
    }

    if (!response.ok) {
      throw new Error("updateMemberColor HTTP response was not OK");
    }

    return response.json().then(
      (json: { updated: ColorUpdate; swapped?: ColorUpdate }): Response => ({
        status: "ok",
        updated: json.updated,
        swapped: json.swapped,
      }),
    );
  });
