import * as z from "zod/v4";
import { fetchVersionedData } from "../api/fetch-versioned-data";
import { skills } from "./skill";

export const diaryTiers = ["Easy", "Medium", "Hard", "Elite"];
export const diaryRegions = [
  "Ardougne",
  "Desert",
  "Falador",
  "Fremennik",
  "Kandarin",
  "Karamja",
  "Kourend & Kebos",
  "Lumbridge & Draynor",
  "Morytania",
  "Varrock",
  "Western Provinces",
  "Wilderness",
];
const diaryTaskSchema = z.object({
  task: z.string(),
  requirements: z
    .object({
      quests: z
        .array(z.uint32())
        .optional()
        .transform(function defaultQuests(quests) {
          return quests ?? [];
        }),
      skills: z
        .partialRecord(z.enum(skills), z.uint32())
        .optional()
        .transform(function mapSkills(skills) {
          return Object.entries(skills ?? {}).map(([skill, level]) => ({ skill, level }));
        }),
    })
    .optional()
    .transform(function defaultRequirements(requirements) {
      return requirements ?? { quests: [], skills: [] };
    }),
});
const diaryDataSchema = z
  .record(
    z.enum(diaryRegions),
    z.record(z.enum(diaryTiers), z.array(diaryTaskSchema)).transform(function mapTiers(tasksByTier) {
      return new Map(Object.entries(tasksByTier));
    }),
  )
  .transform(function mapRegions(tasksByRegion) {
    return new Map(Object.entries(tasksByRegion));
  });

export async function fetchDiaryData() {
  const data = await fetchVersionedData("/data/diary_data.json");

  return diaryDataSchema.parseAsync(data);
}
