import * as DateFNS from "date-fns";
import { utc } from "@date-fns/utc";
import { skillsInBackendOrder } from "../../api/requests/group-data";
import { skillIcons } from "../../game/skill";

export const lineChartYAxisOptions = ["Cumulative experience gained", "Total experience", "Experience per hour"];

export function rangeForPeriod(period, end = new Date()) {
  const durations = { Day: { days: 1 }, Week: { weeks: 1 }, Month: { months: 1 }, Year: { years: 1 } };
  return { start: period === "All" ? undefined : DateFNS.sub(end, durations[period], { in: utc }), end };
}

export function buildLineChartOptions({ range, earliest, latest, yAxisUnit, onNavigate, onNavigateStart }) {
  return {
    maintainAspectRatio: false,
    animation: false,
    parsing: false,
    responsive: true,
    plugins: {
      legend: { position: "top" },
      zoom: {
        limits: { x: { min: earliest?.getTime(), max: latest.getTime(), minRange: 5 * 60 * 1000 } },
        pan: { enabled: true, mode: "x", onPanStart: onNavigateStart, onPanComplete: onNavigate },
        zoom: {
          mode: "x",
          wheel: { enabled: true },
          pinch: { enabled: true },
          onZoomStart: onNavigateStart,
          onZoomComplete: onNavigate,
        },
      },
    },
    interaction: { intersect: false, mode: "nearest", axis: "x" },
    layout: { padding: 4 },
    scales: {
      x: { type: "time", min: range.start?.getTime(), max: range.end.getTime(), time: { minUnit: "minute" } },
      y: { title: { display: true, text: yAxisUnit }, type: "linear", min: 0 },
    },
  };
}

export function buildDatasetsFromMemberSkillData(members, range, options) {
  return members
    .map(function buildDataset({ member, skillSamples, style }) {
      const samples = samplesForRange(skillSamples, range);
      const baseline = samples[0];
      const startingExperience = baseline ? sumFilteredExperience(baseline.data, options.skillFilter) : 0;
      const data = samples.map(function buildPoint(sample, index) {
        const experience = sumFilteredExperience(sample.data, options.skillFilter);
        let value = experience;
        if (options.yAxisUnit === "Cumulative experience gained") {
          value = Math.max(0, experience - startingExperience);
        } else if (options.yAxisUnit === "Experience per hour") {
          const previous = samples[index - 1];
          value = previous
            ? Math.max(
                0,
                (experience - sumFilteredExperience(previous.data, options.skillFilter)) /
                  differenceInHoursPrecise({
                    earlierDate: previous.observationTime ?? previous.time,
                    laterDate: sample.time,
                  }),
              )
            : null;
        }
        return { x: sample.time.getTime(), y: value };
      });
      return {
        label: member,
        data,
        borderColor: style.lineBorder,
        backgroundColor: style.lineBackground,
        stepped: options.yAxisUnit !== "Experience per hour",
        pointRadius: 0,
        pointHoverRadius: 3,
        pointBorderWidth: 0,
        borderWidth: 2,
      };
    })
    .sort(function sortDatasets(first, second) {
      return first.label.localeCompare(second.label);
    });
}

export function samplesForRange(skillSamples, range) {
  const previous = skillSamples.findLast(function isBaseline(sample) {
    return sample.time <= range.start;
  });
  const samples = skillSamples.filter(function isVisible(sample) {
    return sample.time > range.start && sample.time <= range.end;
  });
  if (previous) {
    samples.unshift({ time: range.start, observationTime: previous.time, data: previous.data });
  }
  if (samples.length && samples.at(-1).time < range.end) {
    samples.push({ time: range.end, data: samples.at(-1).data });
  }
  return samples;
}

export function buildTableRowsFromMemberSkillData(members, range, options) {
  const startTime = range.start;
  const endTime = range.end;

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
    const samples = samplesForRange(skillSamples, range);
    if (!samples.length) {
      continue;
    }
    const startSkills = samples[0].data;
    const endSkills = samples.at(-1).data;
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
        key: `member ${name}`,
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
      key: `member ${name}`,
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
        key: `skill ${skill} ${name}`,
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

function differenceInHoursPrecise({ earlierDate, laterDate }) {
  return DateFNS.differenceInMilliseconds(laterDate, earlierDate) / (60 * 60 * 1000);
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
