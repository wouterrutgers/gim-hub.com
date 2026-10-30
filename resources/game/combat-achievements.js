import * as z from "zod/v4";
import { fetchVersionedData } from "../api/fetch-versioned-data";

export const combatAchievementTiers = ["Easy", "Medium", "Hard", "Elite", "Master", "Grandmaster"];

const tasksSchema = z.array(
  z.object({
    id: z.uint32(),
    name: z.string(),
    description: z.string(),
    tier: z.number().int().min(1).max(6),
    monster: z.string(),
  }),
);

export async function fetchCombatAchievementData() {
  return tasksSchema.parse(await fetchVersionedData("/data/combat_achievements.json"));
}
