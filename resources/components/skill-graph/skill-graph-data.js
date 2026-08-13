import * as DateFNS from "date-fns";
import { utc } from "@date-fns/utc";
import { skillsInBackendOrder } from "../../api/requests/group-data";
import { skillIcons } from "../../game/skill";

export const lineChartYAxisOptions = ["Cumulative experience gained", "Total experience", "Experience per hour"];

export function enumerateDateBinsForPeriod(period) {
  const now = new Date(Date.now());
  const dates = [];

  switch (period) {
    case "Day": {
      const start = DateFNS.startOfHour(DateFNS.sub(now, { days: 1 }), { in: utc });
      dates.push(...DateFNS.eachHourOfInterval({ start, end: now }));
      break;
    }
    case "Week": {
      const start = DateFNS.startOfDay(DateFNS.sub(now, { weeks: 1 }), { in: utc });
      dates.push(...DateFNS.eachDayOfInterval({ start, end: now }));
      break;
    }
    case "Month": {
      const start = DateFNS.startOfDay(DateFNS.sub(now, { months: 1 }), { in: utc });
      dates.push(...DateFNS.eachDayOfInterval({ start, end: now }));
      break;
    }
    case "Year": {
      const start = DateFNS.startOfMonth(DateFNS.sub(now, { years: 1 }), { in: utc });
      dates.push(...DateFNS.eachMonthOfInterval({ start, end: now }));
      break;
    }
  }

  dates.push(now);

  return dates.slice(1);
}

export function buildLineChartOptions({ period, yAxisUnit }) {
  const minimumTimeUnitPerPeriod = {
    Day: "hour",
    Week: "day",
    Month: "day",
    Year: "month",
  };

  return {
    maintainAspectRatio: false,
    animation: false,
    normalized: true,
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: {
        display: true,
        text: `Group ${yAxisUnit.toLowerCase()} over the preceding ${period.toLowerCase()}`,
      },
    },
    interaction: {
      intersect: false,
      mode: "index",
    },
    layout: { padding: 4 },
    scales: {
      x: {
        title: { display: false, text: "Time" },
        type: "time",
        time: { minUnit: minimumTimeUnitPerPeriod[period] },
      },
      y: {
        title: { display: true, text: yAxisUnit },
        type: "linear",
        min: 0,
      },
    },
  };
}

export function buildDatasetsFromMemberSkillData(members, dateBins, options) {
  const datasets = [];

  for (const { member, skillSamples, style } of members) {
    const interpolatedSamples = [];
    let skillDataIndex = 0;

    while (interpolatedSamples.length < dateBins.length) {
      const firstSample = skillSamples.at(skillDataIndex);
      const secondSample = skillSamples.at(skillDataIndex + 1);

      if (!firstSample) {
        interpolatedSamples.push(interpolatedSamples.at(-1) ?? 0);
        continue;
      }

      const dateBin = dateBins[interpolatedSamples.length];

      if (DateFNS.compareAsc(firstSample.time, dateBin) > 0) {
        interpolatedSamples.push(
          options.yAxisUnit === "Experience per hour"
            ? sumFilteredExperience(firstSample.data, options.skillFilter)
            : 0,
        );
        continue;
      }

      if (secondSample && DateFNS.compareAsc(dateBin, secondSample.time) > 0) {
        skillDataIndex += 1;
        continue;
      }

      interpolatedSamples.push(
        sumFilteredExperience(interpolateSkillSamples(firstSample, secondSample, dateBin), options.skillFilter),
      );
    }

    datasets.push({
      label: member,
      data: buildChartPoints(interpolatedSamples, dateBins, options.yAxisUnit),
      borderColor: style.lineBorder,
      backgroundColor: style.lineBackground,
    });
  }

  return datasets.sort(function sortDatasets({ label: firstLabel }, { label: secondLabel }) {
    return firstLabel.localeCompare(secondLabel);
  });
}

export function buildTableRowsFromMemberSkillData(members, dateBins, options) {
  const startTime = dateBins.at(0);
  const endTime = dateBins.at(-1);

  if (!startTime || !endTime) {
    return [];
  }

  const elapsedHours = differenceInHoursPrecise({ laterDate: endTime, earlierDate: startTime });
  if (elapsedHours <= 0) {
    console.error("Skill table end time is before or equal to start time.");
    return [];
  }

  let groupMetricTotal = 0;
  const groupMetrics = [];

  for (const { member, skillSamples, style } of members) {
    const startSkills = getExperienceSnapshot(skillSamples, startTime, options.yAxisUnit);
    const endSkills = getExperienceSnapshot(skillSamples, endTime, options.yAxisUnit);
    const memberMetrics = { name: member, total: 0, perSkill: [], colorCSS: style.barBackground };

    for (let skillIndex = 0; skillIndex < skillsInBackendOrder.length; skillIndex++) {
      const skill = skillsInBackendOrder[skillIndex];
      if (!skill || (options.skillFilter !== "Overall" && skill !== options.skillFilter)) {
        continue;
      }

      const start = startSkills[skillIndex] ?? 0;
      const end = endSkills[skillIndex] ?? 0;
      const metricValue = calculateMetricValue({ start, end, elapsedHours, yAxisUnit: options.yAxisUnit });

      if (options.skillFilter === "Overall") {
        memberMetrics.perSkill[skillIndex] = metricValue;
      }

      memberMetrics.total += metricValue;
    }

    groupMetricTotal += memberMetrics.total;
    groupMetrics.push(memberMetrics);
  }

  const rows = [];
  const safeDenominator = groupMetricTotal === 0 ? 1 : groupMetricTotal;
  groupMetrics.sort(function sortMemberMetrics({ total: firstTotal }, { total: secondTotal }) {
    return secondTotal - firstTotal;
  });

  for (const { name, total, perSkill, colorCSS } of groupMetrics) {
    if (options.skillFilter !== "Overall") {
      rows.push({
        name,
        colorCSS: "hsl(69deg, 60%, 60%)",
        fillFraction: total / safeDenominator,
        iconSource: skillIcons[options.skillFilter],
        quantity: total,
        isMemberHeader: true,
      });
      continue;
    }

    const overallFraction = total / safeDenominator;
    rows.push({
      name,
      colorCSS,
      fillFraction: overallFraction,
      iconSource: skillIcons.Overall,
      quantity: total,
      isMemberHeader: true,
    });

    const skillRows = [];
    for (let skillIndex = 0; skillIndex < perSkill.length; skillIndex++) {
      const metricValue = perSkill.at(skillIndex);
      const skill = skillsInBackendOrder[skillIndex];

      if (!metricValue || metricValue <= 0 || !skill) {
        continue;
      }

      skillRows.push({
        name: skill,
        colorCSS,
        fillFraction: (metricValue / total) * overallFraction,
        iconSource: skillIcons[skill],
        quantity: metricValue,
        isMemberHeader: false,
      });
    }

    skillRows.sort(function sortSkillRows({ quantity: firstQuantity }, { quantity: secondQuantity }) {
      return secondQuantity - firstQuantity;
    });
    rows.push(...skillRows);
  }

  return rows;
}

function sumFilteredExperience(skills, skillFilter) {
  return skills.reduce(function sumExperience(sum, experience, index) {
    const skill = skillsInBackendOrder[index];

    return skillFilter === "Overall" || skill === skillFilter ? sum + experience : sum;
  }, 0);
}

function interpolateSkillSamples(firstSample, secondSample, interpolationTime) {
  if (!firstSample && !secondSample) {
    throw new Error("Both XP samples to be interpolated can't be undefined.");
  }

  if (!firstSample) {
    return [...secondSample.data];
  }

  if (!secondSample) {
    return [...firstSample.data];
  }

  if (firstSample.data.length !== secondSample.data.length) {
    throw new Error("Interpolated xp samples don't have same exp length");
  }

  return [...(DateFNS.compareAsc(interpolationTime, secondSample.time) >= 0 ? secondSample : firstSample).data];
}

function buildChartPoints(interpolatedSamples, dateBins, yAxisUnit) {
  const chartPoints = [];

  switch (yAxisUnit) {
    case "Cumulative experience gained": {
      const start = interpolatedSamples[0] ?? 0;
      for (let index = 0; index < interpolatedSamples.length; index++) {
        chartPoints[index] = [dateBins[index], interpolatedSamples[index] - start];
      }
      break;
    }
    case "Experience per hour": {
      chartPoints[0] = [dateBins[0], 0];
      for (let index = 1; index < interpolatedSamples.length; index++) {
        const hoursPerSample = differenceInHoursPrecise({
          laterDate: dateBins[index],
          earlierDate: dateBins[index - 1],
        });
        chartPoints[index] = [
          dateBins[index],
          (interpolatedSamples[index] - interpolatedSamples[index - 1]) / hoursPerSample,
        ];
      }
      break;
    }
    case "Total experience":
      for (let index = 0; index < interpolatedSamples.length; index++) {
        chartPoints[index] = [dateBins[index], interpolatedSamples[index]];
      }
      break;
  }

  return chartPoints;
}

function differenceInHoursPrecise({ earlierDate, laterDate }) {
  return DateFNS.differenceInMilliseconds(laterDate, earlierDate) / (60 * 60 * 1000);
}

function padExperienceArray(experience) {
  return skillsInBackendOrder.map(function getExperience(_, index) {
    return experience?.[index] ?? 0;
  });
}

function getExperienceSnapshot(skillSamples, target, yAxisUnit) {
  if (skillSamples.length === 0) {
    return padExperienceArray(undefined);
  }

  const firstSample = skillSamples[0];
  if (DateFNS.compareAsc(firstSample.time, target) > 0) {
    return yAxisUnit === "Experience per hour" ? padExperienceArray(firstSample.data) : padExperienceArray(undefined);
  }

  for (let index = skillSamples.length - 1; index >= 0; index--) {
    const sample = skillSamples[index];
    if (DateFNS.compareAsc(sample.time, target) <= 0) {
      return padExperienceArray(sample.data);
    }
  }

  return padExperienceArray(skillSamples.at(-1)?.data);
}

function calculateMetricValue({ start, end, elapsedHours, yAxisUnit }) {
  switch (yAxisUnit) {
    case "Total experience":
      return Math.max(0, end);
    case "Experience per hour":
      return Math.max(0, Math.round((end - start) / elapsedHours));
    case "Cumulative experience gained":
      return Math.max(0, end - start);
  }
}
