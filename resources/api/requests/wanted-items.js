import * as z from "zod/v4";
import { request } from "../request";

export const MAX_WANTED_QUANTITY = 2_147_483_647;

const goalSchema = z.object({
  item_id: z.uint32().positive(),
  target_quantity: z.int().min(1).max(MAX_WANTED_QUANTITY),
});
const goalsSchema = z.array(goalSchema);
const conflictSchema = z.object({
  item_id: goalSchema.shape.item_id.optional(),
  target_quantity: goalSchema.shape.target_quantity.nullable(),
});

export class WantedItemConflict extends Error {
  constructor(currentQuantity, itemId) {
    super("The wanted item changed since it was opened.");
    this.currentQuantity = currentQuantity;
    this.itemId = itemId;
  }
}

async function checkWriteResponse(response, message) {
  if (response.status === 409) {
    const { item_id: itemId, target_quantity: currentQuantity } = conflictSchema.parse(await response.json());

    throw new WantedItemConflict(currentQuantity, itemId);
  }

  if (!response.ok) {
    throw new Error(message, { cause: response });
  }
}

export async function fetchWantedItems({ baseURL, credentials }) {
  const response = await request(`${baseURL}/group/${credentials.name}/wanted-items`, {
    headers: { Authorization: credentials.token },
  });

  if (!response.ok) {
    throw new Error("Could not load wanted items.", { cause: response });
  }

  return goalsSchema.parse(await response.json());
}

export async function saveWantedItem({ baseURL, credentials, goal }) {
  const response = await request(`${baseURL}/group/${credentials.name}/wanted-items`, {
    method: "PUT",
    headers: { Authorization: credentials.token, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(goal),
  });

  await checkWriteResponse(response, "Could not save wanted item.");

  return goalSchema.parse(await response.json());
}

export async function removeWantedItem({ baseURL, credentials, itemId, expectedQuantity }) {
  const response = await request(`${baseURL}/group/${credentials.name}/wanted-items/${itemId}`, {
    method: "DELETE",
    headers: { Authorization: credentials.token, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ expected_quantity: expectedQuantity, exact_item_id: true }),
  });

  await checkWriteResponse(response, "Could not remove wanted item.");
}
