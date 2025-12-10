import * as z from "zod/v4";
import { Skill } from "./skill";
import type { QuestID } from "./quests";

export const DiaryTier = ["Easy", "Medium", "Hard", "Elite"] as const;
export type DiaryTier = (typeof DiaryTier)[number];

export const DiaryRegion = [
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
] as const;
export type DiaryRegion = (typeof DiaryRegion)[number];

export type DiaryDatabase = z.infer<typeof DiaryDatabaseSchema>;

export const fetchDiaryDataJSON = (): Promise<DiaryDatabase> =>
  fetch("/data/diary_data.json")
    .then((response) => response.json())
    .then((data) => {
      return DiaryDatabaseSchema.safeParseAsync(data);
    })
    .then((parseResult) => {
      if (!parseResult.success) throw new Error("Failed to parse diary_data.json", { cause: parseResult.error });

      return parseResult.data;
    });

const DiaryTaskSchema = z.object({
  task: z.string(),
  requirements: z
    .object({
      quests: z
        .uint32()
        .array()
        .optional()
        .transform((quests) => quests ?? [])
        .transform((quests) => quests.map((id) => id as QuestID)),
      skills: z
        .partialRecord(z.enum(Skill), z.uint32())
        .optional()
        .transform((record) =>
          Object.entries(record ?? []).map(([skill, level]) => ({
            skill: skill as Skill,
            level,
          })),
        ),
    })
    .optional()
    .transform((requirements) => {
      return requirements ?? { quests: [], skills: [] };
    }),
});
export type DiaryTask = z.infer<typeof DiaryTaskSchema>;

const DiaryRegionTasksSchema = z
  .record(z.enum(DiaryTier), DiaryTaskSchema.array())
  .transform((record) =>
    Object.entries(record).map(([tier, tasks]) => [tier as DiaryTier, tasks] as [DiaryTier, DiaryTask[]]),
  )
  .transform((entries) => new Map(entries));
type DiaryRegionTasks = z.infer<typeof DiaryRegionTasksSchema>;

const DiaryDatabaseSchema = z
  .record(z.enum(DiaryRegion), DiaryRegionTasksSchema)
  .transform((record) =>
    Object.entries(record).map(
      ([region, tasksByTier]) => [region as DiaryRegion, tasksByTier] satisfies [DiaryRegion, DiaryRegionTasks],
    ),
  )
  .transform((entries) => new Map(entries));
