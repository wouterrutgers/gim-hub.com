import * as z from "zod/v4";
import * as Member from "../../game/member";
import { DateSchema } from "./shared";
import type { Experience } from "../../game/skill";
import type { GroupCredentials } from "../credentials";

export const AggregatePeriod = ["Day", "Week", "Month", "Year"] as const;
/**
 * Enumerates the finite number of periods the server stores experience
 * information for, extending backwards from the current moment in time.
 */
export type AggregatePeriod = (typeof AggregatePeriod)[number];

export type Response = z.infer<typeof GetSkillDataSchema>;

/**
 * Returns a promise that resolves with experience history for all members of
 * the group, for the given aggregate period.
 *
 * @param baseURL Base URL of API, such as https://backend.foo.com/api/
 */
export const fetchSkillData = ({
  baseURL,
  credentials,
  period,
}: {
  baseURL: string;
  credentials: GroupCredentials;
  period: AggregatePeriod;
}): Promise<Response> =>
  fetch(`${baseURL}/group/${credentials.name}/get-skill-data?period=${period}`, {
    headers: { Authorization: credentials.token },
  })
    .then((response) => response.json())
    .then((json) => GetSkillDataSchema.safeParseAsync(json))
    .then((parseResult) => {
      if (!parseResult.success) throw new Error("Failed to parse GetSkillData response", { cause: parseResult.error });
      return parseResult.data;
    });

const GROUP_MAX_MEMBERS = 5;

const MemberSkillDataSchema = z.object({
  time: DateSchema,
  data: z
    .uint32()
    .transform((xp) => xp as Experience)
    .array()
    .length(23),
});
type MemberSkillData = z.infer<typeof MemberSkillDataSchema>;

const GetSkillDataSchema = z
  .object({
    name: z.string().transform((name) => name as Member.Name),
    skill_data: MemberSkillDataSchema.array(),
  })
  .array()
  .refine((flat) => flat.length <= GROUP_MAX_MEMBERS)
  .refine((flat) => {
    const encountered = new Set<Member.Name>();
    for (const { name } of flat) {
      if (encountered.has(name)) return false;
      encountered.add(name);
    }
    return true;
  })
  .transform((flat) => {
    const map = new Map<Member.Name, MemberSkillData[]>();
    for (const { name, skill_data } of flat) {
      map.set(name, skill_data);
    }
    return map;
  });
