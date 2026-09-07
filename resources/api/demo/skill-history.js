import * as DateFNS from "date-fns";
import { utc } from "@date-fns/utc";
import { skillsInBackendOrder } from "../requests/group-data";

export function populateSkillDataFromRoster(state) {
  const now = new Date();
  const recentStart = DateFNS.startOfDay(DateFNS.subDays(now, 30), { in: utc });
  const hourlyStart = DateFNS.startOfMonth(DateFNS.subYears(now, 1), { in: utc });
  const earliest = DateFNS.startOfMonth(DateFNS.subYears(now, 2), { in: utc });
  const dates = [
    ...DateFNS.eachMonthOfInterval({ start: earliest, end: DateFNS.subMonths(hourlyStart, 1) }, { in: utc }),
    ...DateFNS.eachHourOfInterval({ start: hourlyStart, end: DateFNS.subHours(recentStart, 1) }, { in: utc }),
    ...DateFNS.eachMinuteOfInterval({ start: recentStart, end: now }, { step: 5, in: utc }),
  ];
  state.skillData = new Map();
  for (const [memberIndex, { displayName }] of state.roster.entries()) {
    const samples = dates.map(function createSample(time) {
      const hours = (time - earliest) / 3_600_000;
      const activeHours = Math.floor(hours / 24) * 6 + Math.min(6, Math.max(0, (hours % 24) - 12));
      return {
        time,
        data: skillsInBackendOrder.map(function createExperience(_, skillIndex) {
          return Math.floor(100_000 + activeHours * (memberIndex + 1) * ((skillIndex % 5) + 1) * 150);
        }),
      };
    });
    state.skillData.set(displayName, samples);
  }
}

export function getDemoSkillHistory(state, { start, end }) {
  const earliest = state.skillData.values().next().value?.[0].time ?? null;
  start ??= earliest ?? DateFNS.subDays(end, 1);
  const bucketMilliseconds = Math.max(1000, Math.ceil((end - start) / 1500 / 1000) * 1000);
  const members = new Map();
  for (const [member, samples] of state.skillData) {
    const baseline = samples.findLast(function isBaseline(sample) {
      return sample.time <= start;
    });
    const visible = samples.filter(function isVisible(sample) {
      return sample.time > start && sample.time <= end;
    });
    const buckets = new Map();
    for (const sample of visible) {
      buckets.set(Math.floor((sample.time - start - 1) / bucketMilliseconds), sample);
    }
    members.set(member, [...new Set([baseline, visible[0], ...buckets.values()].filter(Boolean))]);
  }
  return structuredClone({ start, end, earliest, members });
}
