import { useContext, useEffect, useRef, useState, type ReactElement } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { AggregatePeriod } from "../../api/requests/skill-data";
import * as DateFNS from "date-fns";
import { Context as APIContext } from "../../context/api-context";
import { Skill, SkillIconsBySkill, type Experience } from "../../game/skill";
import * as Member from "../../game/member";
import { LoadingScreen } from "../loading-screen/loading-screen";
import { SkillsInBackendOrder } from "../../api/requests/group-data";
import { utc } from "@date-fns/utc";
import { Link } from "react-router-dom";
import { CachedImage } from "../cached-image/cached-image";
import { GroupMemberColorsContext } from "../../context/group-context";

import "./skill-graph.css";

import "chartjs-adapter-date-fns";
ChartJS.register(CategoryScale, TimeScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const SkillFilteringOption = ["Overall", ...Skill] as const;
type SkillFilteringOption = (typeof SkillFilteringOption)[number];

const LineChartYAxisOption = ["Cumulative experience gained", "Total experience", "Experience per hour"] as const;
type LineChartYAxisOption = (typeof LineChartYAxisOption)[number];

interface SkillGraphOptions {
  period: AggregatePeriod;
  yAxisUnit: LineChartYAxisOption;
  skillFilter: SkillFilteringOption;
}

interface SkillGraphTableRow {
  iconSource: string;
  name: string;
  quantity: number;
  colorCSS: string;
  fillFraction: number;
  isMemberHeader: boolean;
}

interface SkillChart {
  data: ChartData<"line", [Date, number][], string>;
  options: ChartOptions<"line">;
}

/** CSS Style for both the bar graph and line chart */
interface SkillGraphMemberStyle {
  lineBorder: string;
  lineBackground: string;
  barBackground: string;
}

/** The input data that is used to construct all the graphs for a single member, such as style and skill experience samples. */
interface SkillGraphMember {
  member: Member.Name;
  skillSamples: { time: Date; data: Experience[] }[];
  style: SkillGraphMemberStyle;
}

/**
 * Returns the difference in hours between two dates more precisely, since the
 * native Date-FNS function rounded to the nearest hour.
 */
const differenceInHoursPrecise = ({ earlierDate, laterDate }: { earlierDate: Date; laterDate: Date }): number => {
  const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
  return DateFNS.differenceInMilliseconds(laterDate, earlierDate) / MILLISECONDS_PER_HOUR;
};

/**
 * Returns the finitely enumerated x-axis positions for a given aggregate
 * period. Each position should be assigned a y-value then displayed on the
 * chart.
 */
const enumerateDateBinsForPeriod = (period: AggregatePeriod): Date[] => {
  const now = new Date(Date.now());

  const dates: Date[] = [];

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
    }
  }

  dates.push(now);

  return dates.slice(1);
};

const buildLineChartOptions = ({ period, yAxisUnit }: SkillGraphOptions): ChartOptions<"line"> => {
  /*
   * Let ChartJS + DateFNS adapter make their best guess for the unit, but not
   * go ridiculously low since we know the scale of our charts.
   */
  const minimumTimeUnitPerPeriod: Record<
    AggregatePeriod,
    "millisecond" | "second" | "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year"
  > = {
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
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: `Group ${yAxisUnit} for the Preceding ${period}`,
      },
    },
    interaction: {
      intersect: false,
      mode: "index",
    },
    layout: {
      padding: 4,
    },
    scales: {
      x: {
        title: {
          display: false,
          text: "Time",
        },
        type: "time",
        time: {
          minUnit: minimumTimeUnitPerPeriod[period],
        },
      },
      y: {
        title: { display: true, text: yAxisUnit },
        type: "linear",
        min: 0,
      },
    },
  };
};

/**
 * Returns experience values for a date bin. We keep the latest known value
 * (step function) instead of linearly interpolating between samples so the
 * chart does not show fabricated gains during periods with no tracking data.
 */
const interpolateSkillSamples = (
  sampleA: { time: Date; data: Experience[] } | undefined,
  sampleB: { time: Date; data: Experience[] } | undefined,
  interpolationTime: Date,
): Experience[] => {
  if (!sampleA && !sampleB) {
    throw new Error("Both XP samples to be interpolated can't be undefined.");
  }

  if (!sampleA && sampleB) {
    return [...sampleB.data];
  }
  if (!sampleB && sampleA) {
    return [...sampleA.data];
  }

  if (sampleA!.data.length !== sampleB!.data.length)
    throw new Error("Interpolated xp samples don't have same exp length");

  const useSecondSample = DateFNS.compareAsc(interpolationTime, sampleB!.time) >= 0;

  return [...(useSecondSample ? sampleB! : sampleA!).data];
};

/**
 * Takes in a bunch of experience samples for all members, then outputs the data
 * with all samples binned and data filled in for display on the chart.
 *
 * The reason that we bin the dates is that we want all members to have both be
 * true:
 *  1) All member datasets have the same number of points on the chart
 *  2) All points across datasets share the same x-value.
 *
 * SkillData values should be sorted by date in ascending order already.
 */
const buildDatasetsFromMemberSkillData = (
  members: SkillGraphMember[],
  dateBins: Date[],
  options: {
    yAxisUnit: LineChartYAxisOption;
    skillFilter: SkillFilteringOption;
  },
): { label: string; data: [Date, number][]; borderColor: string; backgroundColor: string }[] => {
  const sumFilteredExperience = (skills: Experience[]): Experience =>
    skills.reduce((sum, xp, index) => {
      if (options.skillFilter !== "Overall" && Skill[index] !== options.skillFilter) return sum;

      return sum + xp;
    }, 0) as Experience;

  /**
   * Treat the samples as a step function: we reuse the most recent sample until
   * tracking reports a new value. This avoids implying that experience was
   * gained between updates while still giving every member the same number of
   * data points.
   */
  const datasets = [];
  for (const { member, skillSamples, style } of members) {
    const interpolatedSamples: Experience[] = [];

    let skillDataIndex = 0;
    while (interpolatedSamples.length < dateBins.length) {
      /*
       * Assume these are in chronological order, because the input data was
       * sorted down in the react component.
       */
      const firstSample = skillSamples.at(skillDataIndex);
      const secondSample = skillSamples.at(skillDataIndex + 1);

      /*
       * firstSample is undefined if we reached the end of all samples. At this
       * point, we can only forward fill the newest sample.
       */
      if (!firstSample) {
        const previous = interpolatedSamples.at(-1) ?? (0 as Experience);
        interpolatedSamples.push(previous);
        continue;
      }

      const dateBinIndex = interpolatedSamples.length;
      const dateBin = dateBins[dateBinIndex];

      /*
       * If we are about to sample before the interval, we need to come up with
       * some data to put in. This only occurs if the tracked history does not
       * reach all date bins (for example, a recently added member). This should
       * be a fairly rare occurrence, so we push whatever makes the data look
       * nicest.
       *
       * TODO: have backend send dates indicating the start of history for each
       * member? To differentiate between missing data vs date bin mismatch
       */
      if (DateFNS.compareAsc(firstSample.time, dateBin) > 0) {
        switch (options.yAxisUnit) {
          case "Total experience":
          case "Cumulative experience gained":
          default:
            interpolatedSamples.push(0 as Experience);
            break;
          case "Experience per hour":
            interpolatedSamples.push(sumFilteredExperience(firstSample.data));
            break;
        }
        continue;
      }

      // If we are about to sample after the interval, we increment the interval
      if (secondSample && DateFNS.compareAsc(dateBin, secondSample.time) > 0) {
        skillDataIndex += 1;
        continue;
      }

      interpolatedSamples.push(sumFilteredExperience(interpolateSkillSamples(firstSample, secondSample, dateBin)));
    }

    const chartPoints: [Date, number][] = [];
    switch (options.yAxisUnit) {
      case "Cumulative experience gained": {
        const start = interpolatedSamples[0] ?? 0;
        for (let i = 0; i < interpolatedSamples.length; i++) {
          chartPoints[i] = [dateBins[i], interpolatedSamples[i] - start];
        }
        break;
      }
      case "Experience per hour": {
        chartPoints[0] = [dateBins[0], 0];
        for (let i = 1; i < interpolatedSamples.length; i++) {
          const hoursPerSample = differenceInHoursPrecise({ laterDate: dateBins[i], earlierDate: dateBins[i - 1] });
          const experienceGained = interpolatedSamples[i] - interpolatedSamples[i - 1];
          chartPoints[i] = [dateBins[i], experienceGained / hoursPerSample];
        }
        break;
      }
      case "Total experience":
        for (let i = 0; i < interpolatedSamples.length; i++) {
          chartPoints[i] = [dateBins[i], interpolatedSamples[i]];
        }
        break;
    }

    datasets.push({
      label: member,
      data: chartPoints,
      borderColor: style.lineBorder,
      backgroundColor: style.lineBackground,
    });
  }

  return datasets.sort(({ label: labelA }, { label: labelB }) => labelA.localeCompare(labelB));
};

const padExperienceArray = (experience: Experience[] | undefined): Experience[] => {
  return SkillsInBackendOrder.map((_, index) => (experience?.[index] ?? 0) as Experience);
};

const getExperienceSnapshot = (
  skillSamples: { time: Date; data: Experience[] }[],
  target: Date,
  yAxisUnit: LineChartYAxisOption,
): Experience[] => {
  if (skillSamples.length === 0) return padExperienceArray(undefined);

  const firstSample = skillSamples[0];
  if (DateFNS.compareAsc(firstSample.time, target) > 0) {
    if (yAxisUnit === "Experience per hour") {
      return padExperienceArray(firstSample.data);
    }

    return padExperienceArray(undefined);
  }

  for (let index = skillSamples.length - 1; index >= 0; index--) {
    const sample = skillSamples[index];
    if (DateFNS.compareAsc(sample.time, target) <= 0) {
      return padExperienceArray(sample.data);
    }
  }

  return padExperienceArray(skillSamples.at(-1)?.data);
};

const buildTableRowsFromMemberSkillData = (
  members: SkillGraphMember[],
  dateBins: Date[],
  options: {
    yAxisUnit: LineChartYAxisOption;
    skillFilter: SkillFilteringOption;
  },
): SkillGraphTableRow[] => {
  const startTime = dateBins.at(0);
  const endTime = dateBins.at(-1);

  if (!startTime || !endTime) return [];

  const elapsedHours = differenceInHoursPrecise({ laterDate: endTime, earlierDate: startTime });
  if (elapsedHours <= 0) {
    console.error("Skill table end time is before or equal to start time.");
    return [];
  }

  let groupMetricTotal = 0;
  const groupMetrics: { name: Member.Name; total: number; perSkill: number[]; colorCSS: string }[] = [];

  for (const { member, skillSamples, style } of members) {
    const startSkills = getExperienceSnapshot(skillSamples, startTime, options.yAxisUnit);
    const endSkills = getExperienceSnapshot(skillSamples, endTime, options.yAxisUnit);

    const memberMetrics = {
      name: member,
      total: 0,
      perSkill: [] as number[],
      colorCSS: style.barBackground,
    };

    for (let skillIndex = 0; skillIndex < SkillsInBackendOrder.length; skillIndex++) {
      const skill = SkillsInBackendOrder[skillIndex];
      if (!skill) continue;
      if (options.skillFilter !== "Overall" && skill !== options.skillFilter) continue;

      const start = startSkills[skillIndex] ?? (0 as Experience);
      const end = endSkills[skillIndex] ?? (0 as Experience);

      let metricValue = 0;
      switch (options.yAxisUnit) {
        case "Total experience":
          metricValue = Math.max(0, end);
          break;
        case "Experience per hour": {
          if (elapsedHours > 0) {
            metricValue = Math.max(0, Math.round((end - start) / elapsedHours));
          }
          break;
        }
        case "Cumulative experience gained":
        default: {
          metricValue = Math.max(0, end - start);
          break;
        }
      }

      if (options.skillFilter === "Overall") {
        memberMetrics.perSkill[skillIndex] = metricValue;
      }

      memberMetrics.total += metricValue;
    }

    groupMetricTotal += memberMetrics.total;
    groupMetrics.push(memberMetrics);
  }

  const rows: SkillGraphTableRow[] = [];
  groupMetrics.sort(({ total: a }, { total: b }) => b - a);

  const safeDenominator = groupMetricTotal === 0 ? 1 : groupMetricTotal;

  for (const { name, total, perSkill, colorCSS } of groupMetrics) {
    if (options.skillFilter !== "Overall") {
      const skill: Skill = options.skillFilter;
      rows.push({
        name,
        colorCSS: `hsl(69deg, 60%, 60%)`,
        fillFraction: total / safeDenominator,
        iconSource: SkillIconsBySkill[skill],
        quantity: total,
        isMemberHeader: true,
      });
      continue;
    }

    const overallFraction = total / safeDenominator;
    const header: SkillGraphTableRow = {
      name,
      colorCSS,
      fillFraction: overallFraction,
      iconSource: SkillIconsBySkill.Overall,
      quantity: total,
      isMemberHeader: true,
    };

    const skillRows: SkillGraphTableRow[] = [];
    for (let skillIndex = 0; skillIndex < perSkill.length; skillIndex++) {
      const metricValue = perSkill.at(skillIndex);
      const skill = SkillsInBackendOrder[skillIndex];

      if (!metricValue || metricValue <= 0 || !skill) continue;

      const fraction = total > 0 ? metricValue / total : 0;
      skillRows.push({
        name: skill,
        colorCSS,
        fillFraction: fraction * overallFraction,
        iconSource: SkillIconsBySkill[skill],
        quantity: metricValue,
        isMemberHeader: false,
      });
    }

    rows.push(header);
    rows.push(...skillRows.sort(({ quantity: a }, { quantity: b }) => b - a));
  }

  return rows;
};

interface SkillGraphDropdownProps<TOption extends string> {
  current: TOption;
  options: readonly TOption[];
  setter: (value: TOption) => void;
}
const SkillGraphDropdown = <TOption extends string>({
  current,
  options,
  setter,
}: SkillGraphDropdownProps<TOption>): ReactElement => {
  return (
    <div className="skill-graph-dropdown rsborder-tiny rsbackground rsbackground-hover">
      <select
        value={current}
        onChange={({ target }) => {
          const selected = target.options[target.selectedIndex].value;
          if (!options.includes(selected as TOption)) return;
          setter(selected as TOption);
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};

export const SkillGraph = (): ReactElement => {
  const [options, setOptions] = useState<SkillGraphOptions>({
    period: "Day",
    yAxisUnit: "Cumulative experience gained",
    skillFilter: "Overall",
  });

  const [tableRowData, setTableRowData] = useState<SkillGraphTableRow[]>([]);
  const [chart, setChart] = useState<SkillChart>({
    data: { datasets: [] },
    options: buildLineChartOptions(options),
  });

  const [loading, setLoading] = useState<boolean>(true);
  const updateChartPromiseRef = useRef<Promise<void>>(undefined);

  const memberColors = useContext(GroupMemberColorsContext);

  const { fetchSkillData } = useContext(APIContext)?.api ?? {};

  useEffect(() => {
    if (!fetchSkillData) return;

    const { period, yAxisUnit, skillFilter } = options;
    setLoading(true);
    const promise = Promise.allSettled([
      fetchSkillData(period),
      new Promise<void>((resolve) => setTimeout(() => resolve(), 1000)),
    ])
      .then(([result]) => {
        if (result.status !== "fulfilled") return;
        if (updateChartPromiseRef.current !== promise) return;

        const dates = enumerateDateBinsForPeriod(period);

        const skillData = result.value;

        const memberChartData: SkillGraphMember[] = [];

        // From here on out, the skill samples are sorted. This is important for sampling them.
        for (const [member, skillSamples] of skillData) {
          const hueDegrees = memberColors.get(member)?.hueDegrees;
          if (!hueDegrees || skillSamples.length === 0) continue;

          memberChartData.push({
            member,
            style: {
              lineBorder: `hsl(${hueDegrees}deg 60% 50%)`,
              lineBackground: `hsl(${hueDegrees}deg 60% 40%)`,
              barBackground: `hsl(${hueDegrees}deg 60% 40%)`,
            },
            skillSamples: [...skillSamples].sort(({ time: timeA }, { time: timeB }) =>
              DateFNS.compareAsc(timeA, timeB),
            ),
          });
        }

        const data = {
          datasets: buildDatasetsFromMemberSkillData(memberChartData, dates, {
            yAxisUnit,
            skillFilter,
          }).map(({ label, data, borderColor, backgroundColor }) => {
            return {
              label,
              borderColor,
              backgroundColor,
              data,
              pointBorderWidth: 0,
              pointHoverBorderWidth: 0,
              pointHoverRadius: 3,
              pointRadius: 0,
              borderWidth: 2,
            };
          }),
        };
        setChart({
          data,
          options: buildLineChartOptions(options),
        });

        setTableRowData(
          buildTableRowsFromMemberSkillData(memberChartData, dates, {
            yAxisUnit: yAxisUnit,
            skillFilter: skillFilter,
          }),
        );
      })
      .finally(() => {
        if (updateChartPromiseRef.current !== promise) return;

        updateChartPromiseRef.current = undefined;
        setLoading(false);
      });
    updateChartPromiseRef.current = promise;
  }, [options, fetchSkillData, memberColors]);

  const { period, yAxisUnit, skillFilter } = options;

  const style = getComputedStyle(document.body);
  ChartJS.defaults.font.family = "rssmall";
  ChartJS.defaults.font.size = 16;
  ChartJS.defaults.color = style.getPropertyValue("--white");
  ChartJS.defaults.scale.grid.color = style.getPropertyValue("--graph-grid-border");

  const loadingOverlay = loading ? (
    <div id="skill-graph-loading-overlay">
      <LoadingScreen />
    </div>
  ) : undefined;

  let xpGainsTable = undefined;

  if (!loading && chart.data.datasets.length === 0) {
    xpGainsTable = (
      <div id="skill-graph-no-data">
        <h3>Your group has no recorded skill data!</h3>
        <p>
          Either no members have logged in more than a couple hours with the plugin, or there is an issue. Please double
          check that the names in the{" "}
          <Link to="../settings" className="orange-link">
            settings
          </Link>{" "}
          page <span className="emphasize">exactly</span> match your group members' in-game display names.
        </p>
      </div>
    );
  }

  if (chart.data.datasets.length > 0) {
    const tableRowElements = [];
    for (const { colorCSS, fillFraction, iconSource, name, quantity, isMemberHeader } of tableRowData) {
      const fillPercent = Math.max(0.1, Math.min(100, 100 * fillFraction));
      tableRowElements.push(
        <tr
          key={`${iconSource} ${name} ${quantity} ${fillFraction} ${colorCSS}`}
          className={isMemberHeader ? "skill-graph-member-header" : undefined}
          style={{
            background: `linear-gradient(90deg, ${colorCSS} ${fillPercent}%, transparent ${fillPercent}%)`,
          }}
        >
          <td className="skill-graph-xp-change-table-label">
            <CachedImage alt="attack" src={iconSource} />
            {name}
          </td>
          <td className="skill-graph-xp-change-data">+{quantity.toLocaleString()}</td>
        </tr>,
      );
    }

    xpGainsTable = (
      <table id="skill-graph-xp-change-table">
        <tbody>{tableRowElements}</tbody>
      </table>
    );
  }

  return (
    <>
      <div id="skill-graph-control-container">
        <SkillGraphDropdown
          current={period}
          options={AggregatePeriod}
          setter={(period) => setOptions({ ...options, period })}
        />
        <SkillGraphDropdown
          current={yAxisUnit}
          options={LineChartYAxisOption}
          setter={(yAxisUnit) => setOptions({ ...options, yAxisUnit })}
        />
        <SkillGraphDropdown
          current={skillFilter}
          options={SkillFilteringOption}
          setter={(skillFilter) => setOptions({ ...options, skillFilter })}
        />
      </div>
      <div id="skill-graph-body" className="rsborder rsbackground">
        <div id="skill-graph-container" className="rsborder-tiny">
          <CachedImage
            alt={skillFilter}
            id="skill-graph-skill-image"
            loading="lazy"
            src={SkillIconsBySkill[skillFilter]}
          />
          <div id="skill-graph-line-chart-container">
            <Line options={chart.options} data={chart.data} />
          </div>
        </div>
        {xpGainsTable}
        {loadingOverlay}
      </div>
    </>
  );
};
