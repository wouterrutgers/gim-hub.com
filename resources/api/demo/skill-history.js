import * as DateFNS from "date-fns";
import { utc } from "@date-fns/utc";
import { skills } from "../../game/skill";
import { aggregatePeriods } from "../requests/skill-data";

export function populateSkillDataFromRoster(state) {
  for (const period of aggregatePeriods) {
    const now = new Date(Date.now());
    let dates = [];
    switch (period) {
      case "Day": {
        const start = DateFNS.startOfHour(
          DateFNS.sub(now, {
            days: 1,
          }),
          {
            in: utc,
          },
        );
        dates.push(
          ...DateFNS.eachHourOfInterval({
            start,
            end: now,
          }),
        );
        break;
      }
      case "Week": {
        const start = DateFNS.startOfDay(
          DateFNS.sub(now, {
            weeks: 1,
          }),
          {
            in: utc,
          },
        );
        dates.push(
          ...DateFNS.eachDayOfInterval({
            start,
            end: now,
          }),
        );
        break;
      }
      case "Month": {
        const start = DateFNS.startOfDay(
          DateFNS.sub(now, {
            months: 1,
          }),
          {
            in: utc,
          },
        );
        dates.push(
          ...DateFNS.eachDayOfInterval({
            start,
            end: now,
          }),
        );
        break;
      }
      case "Year": {
        const start = DateFNS.startOfMonth(
          DateFNS.sub(now, {
            years: 1,
          }),
          {
            in: utc,
          },
        );
        dates.push(
          ...DateFNS.eachMonthOfInterval({
            start,
            end: now,
          }),
        );
      }
    }
    dates.push(now);
    dates = dates.slice(1);
    const result = new Map();
    for (const { displayName } of state.roster) {
      const samples = [];
      const currentExperience = new Array(skills.length).fill(Math.round(Math.random() * 100_000));
      for (let dateIndex = 0; dateIndex < dates.length; dateIndex++) {
        const time = dates[dateIndex];
        const playerIsOffline =
          (period === "Day" && dateIndex >= 8 && dateIndex <= 16) || (period === "Year" && dateIndex <= 2);
        if (!playerIsOffline) {
          if (dateIndex >= 1) {
            const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
            const hoursSince =
              Math.abs(DateFNS.differenceInMilliseconds(time, dates[dateIndex - 1])) / MILLISECONDS_PER_HOUR;
            for (let skillIndex = 0; skillIndex < currentExperience.length; skillIndex++) {
              const experiencePerHour = Math.max(0, Math.random() - 0.7) * 100_000;
              currentExperience[skillIndex] =
                currentExperience[skillIndex] + Math.floor(hoursSince * experiencePerHour);
            }
          }
          samples.push({
            time,
            data: [...currentExperience],
          });
        }
      }
      result.set(displayName, samples);
    }
    state.skillData[period] = result;
  }
}
