import { request } from "../request";

async function parseMutationResponse(response, operation) {
  if (response.status === 400) {
    const body = await response.json().catch(function reportInvalidResponse(reason) {
      console.error(`${operation} failed to parse response JSON:`, reason);

      return {};
    });

    return {
      status: "error",
      text: body.error ?? "Unknown server error.",
    };
  }

  if (!response.ok) {
    throw new Error(`${operation} HTTP response was not OK`);
  }

  return { status: "ok" };
}

export async function addGroupMember({ baseURL, credentials, member }) {
  const response = await request(`${baseURL}/group/${credentials.name}/add-group-member`, {
    body: JSON.stringify({ name: member }),
    headers: { "Content-Type": "application/json", Authorization: credentials.token },
    method: "POST",
  });

  return parseMutationResponse(response, "addGroupMember");
}

export async function deleteGroupMember({ baseURL, credentials, member }) {
  const response = await request(`${baseURL}/group/${credentials.name}/delete-group-member`, {
    body: JSON.stringify({ name: member }),
    headers: { "Content-Type": "application/json", Authorization: credentials.token },
    method: "DELETE",
  });

  return parseMutationResponse(response, "deleteGroupMember");
}

export async function renameGroupMember({ baseURL, credentials, oldName, newName }) {
  const response = await request(`${baseURL}/group/${credentials.name}/rename-group-member`, {
    body: JSON.stringify({ original_name: oldName, new_name: newName }),
    headers: { "Content-Type": "application/json", Authorization: credentials.token },
    method: "PUT",
  });

  return parseMutationResponse(response, "renameGroupMember");
}

export async function updateMemberColor({ baseURL, credentials, memberName, colorHueDegrees }) {
  const response = await request(`${baseURL}/group/${credentials.name}/update-member-color`, {
    body: JSON.stringify({ name: memberName, color_hue_degrees: colorHueDegrees }),
    headers: { "Content-Type": "application/json", Authorization: credentials.token },
    method: "PUT",
  });

  if (response.status === 404) {
    return { status: "error", text: "Member not found." };
  }

  const result = await parseMutationResponse(response, "updateMemberColor");

  if (result.status === "error") {
    return result;
  }

  const body = await response.json();

  return { status: "ok", updated: body.updated, swapped: body.swapped };
}
