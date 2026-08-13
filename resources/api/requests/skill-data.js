import * as z from "zod/v4";
import { dateSchema } from "./shared";

export const aggregatePeriods = ["Day", "Week", "Month", "Year"];

export async function fetchSkillData({ baseURL, credentials, period }) {
  const response = await fetch(`${baseURL}/group/${credentials.name}/get-skill-data?period=${period}`, {
    headers: {
      Authorization: credentials.token,
    },
  });

  if (!response.ok) {
    throw new Error("GetSkillData HTTP response was not OK");
  }

  const result = await skillDataSchema.safeParseAsync(await response.json());

  if (!result.success) {
    throw new Error("Failed to parse GetSkillData response", {
      cause: result.error,
    });
  }

  return result.data;
}

const GROUP_MAX_MEMBERS = 5;
const memberSkillDataSchema = z.object({
  time: dateSchema,
  data: z.array(z.uint32()).length(24),
});
const skillDataSchema = z
  .object({
    name: z.string(),
    skill_data: memberSkillDataSchema.array(),
  })
  .array()
  .refine(function hasValidMemberCount(members) {
    return members.length <= GROUP_MAX_MEMBERS;
  })
  .refine(function hasUniqueMembers(members) {
    const encountered = new Set();

    for (const { name } of members) {
      if (encountered.has(name)) {
        return false;
      }

      encountered.add(name);
    }

    return true;
  })
  .transform(function mapSkillData(members) {
    const skillData = new Map();

    for (const { name, skill_data: samples } of members) {
      skillData.set(name, samples);
    }

    return skillData;
  });
