import * as z from "zod/v4";
import * as DateFNS from "date-fns";
import { utc } from "@date-fns/utc";
import { dateSchema } from "./shared";

export function rangeForPeriod(period, end = new Date()) {
  const durations = { Day: { days: 1 }, Week: { weeks: 1 }, Month: { months: 1 }, Year: { years: 1 } };
  return { start: period === "All" ? undefined : DateFNS.sub(end, durations[period], { in: utc }), end };
}

export async function fetchSkillData({ baseURL, credentials, period, start, end }) {
  const query = new URLSearchParams();
  if (period) {
    query.set("period", period);
  } else {
    query.set("end", end.toISOString());

    if (start) {
      query.set("start", start.toISOString());
    }
  }
  const response = await fetch(`${baseURL}/group/${credentials.name}/get-skill-data?${query}`, {
    headers: { Authorization: credentials.token },
  });

  if (!response.ok) {
    throw new Error("GetSkillData HTTP response was not OK");
  }

  return skillDataSchema.parseAsync(await response.json());
}

const memberSkillDataSchema = z.object({
  time: dateSchema,
  data: z.array(z.uint32()).length(24),
});

export const skillDataSchema = z.object({
  start: dateSchema,
  end: dateSchema,
  earliest: dateSchema.nullable(),
  members: z
    .array(z.object({ name: z.string(), skill_data: memberSkillDataSchema.array() }))
    .max(5)
    .refine(function hasUniqueMembers(members) {
      return (
        new Set(
          members.map(function getName(member) {
            return member.name;
          }),
        ).size === members.length
      );
    })
    .transform(function mapMembers(members) {
      return new Map(
        members.map(function mapMember(member) {
          return [member.name, member.skill_data];
        }),
      );
    }),
});
