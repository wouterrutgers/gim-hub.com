import * as z from "zod/v4";
import { fetchVersionedData } from "../api/fetch-versioned-data";

const questDifficulty = ["Novice", "Intermediate", "Experienced", "Master", "Grandmaster", "Special"];
const questDataSchema = z
  .record(
    z.string(),
    z.object({
      name: z.string(),
      difficulty: z.enum(questDifficulty),
      points: z
        .union([z.string(), z.uint32()])
        .transform(function parsePoints(points) {
          return typeof points === "number" ? points : Number.parseInt(points);
        })
        .refine(Number.isInteger)
        .refine(function isPositive(points) {
          return points >= 0;
        }),
      member: z.boolean(),
      miniquest: z.boolean().optional(),
      tutorial: z.boolean().optional(),
      hidden: z.boolean().optional(),
    }),
  )
  .transform(function mapQuests(quests) {
    const entries = Object.entries(quests).map(([questId, quest]) => [Number.parseInt(questId), quest]);

    return new Map(entries.sort(([leftId], [rightId]) => leftId - rightId));
  });

export async function fetchQuestData() {
  const data = await fetchVersionedData("/data/quest_data.json");
  return questDataSchema.parseAsync(data);
}
