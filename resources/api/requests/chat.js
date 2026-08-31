import * as z from "zod/v4";
import { dateSchema } from "./shared";

const chatMessageSchema = z.object({
  id: z.number().int().positive(),
  sender_name: z.string(),
  message: z.string(),
  sent_at: dateSchema,
  color_hue_degrees: z
    .number()
    .int()
    .nullish()
    .transform(function omitNull(value) {
      return value ?? undefined;
    }),
});

const chatMessagesSchema = z.array(chatMessageSchema).transform(function mapMessages(messages) {
  return messages.map(function mapMessage({ sender_name, sent_at, color_hue_degrees, ...rest }) {
    return {
      ...rest,
      senderName: sender_name,
      sentAt: sent_at,
      colorHueDegrees: color_hue_degrees,
    };
  });
});

export async function fetchChatMessages({ baseURL, credentials, afterId }) {
  const response = await fetch(`${baseURL}/group/${credentials.name}/chat-messages?after_id=${afterId ?? 0}`, {
    headers: { Authorization: credentials.token },
  });

  if (!response.ok) {
    throw new Error("fetchChatMessages HTTP response was not OK");
  }

  const parseResult = chatMessagesSchema.safeParse(await response.json());

  if (!parseResult.success) {
    throw new Error("fetchChatMessages response payload was malformed.", { cause: parseResult.error });
  }

  return parseResult.data;
}
