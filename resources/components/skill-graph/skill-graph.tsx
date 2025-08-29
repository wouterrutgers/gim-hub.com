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

  return dates;
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
 * Returns the array of experience linearly interpolated between two samples
 * based on time. If one of the endpoints is undefined, the other is returned.
 * At least one of sampleA and sampleB needs to be defined.
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

  // The intermediate results are signed, so we preserve the ordering and the signs cancel out
  const overallHours = DateFNS.differenceInSeconds(sampleB!.time, sampleA!.time);
  const fractionOfInterval = DateFNS.differenceInSeconds(interpolationTime, sampleA!.time) / overallHours;

  const result: Experience[] = [];
  for (let i = 0; i < sampleA!.data.length; i++) {
    const interpolatedExperience = Math.floor(
      sampleA!.data[i] * (1 - fractionOfInterval) + sampleB!.data[i] * fractionOfInterval,
    ) as Experience;
    result.push(interpolatedExperience);
  }

  return result;
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
   * We interpret the skillData samples as a polynomial, and sample the points
   * along of the polynomial for our bins. Our best guess is linear
   * interpolation, which will lead to aliasing but we can't do much better
   * without building up the backend a bit more. Since we clamped our date bins
   * to UTC midnight, which the server also does, we aren't interpolating a lot,
   * just where there are gaps.
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
       * some data to put in. This only occurs if the polynomial does not cover
       * all datebins, like if the server is missing data from the past or a
       * member was recently added. This should be a fairly rare occurrence, so
       * we push whatever makes the data look nicest.
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
        const start = interpolatedSamples[1] ?? 0;
        for (let i = 0; i < interpolatedSamples.length; i++) {
          chartPoints[i] = [dateBins[i], interpolatedSamples[i] - start];
        }
        break;
      }
      case "Experience per hour": {
        for (let i = 0; i < interpolatedSamples.length; i++) {
          const hoursPerSample = DateFNS.differenceInHours(dateBins[i], dateBins[i - 1]);
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

const buildTableRowsFromMemberSkillData = (
  members: SkillGraphMember[],
  options: {
    yAxisUnit: LineChartYAxisOption;
    skillFilter: SkillFilteringOption;
  },
): SkillGraphTableRow[] => {
  // Aggregates we so we can compute what fraction of total gains over a period each member did
  let groupGainTotal = 0 as Experience;

  // Individual gains to display for the individual rows
  const groupGains: { name: Member.Name; total: Experience; perSkill: Experience[]; colorCSS: string }[] = [];

  for (const { member, skillSamples, style } of members) {
    const memberGain = {
      name: member,
      total: 0 as Experience,
      perSkill: [] as Experience[],
      colorCSS: style.barBackground,
    };

    const samplesSortedOldestFirst = skillSamples.sort(({ time: timeA }, { time: timeB }) =>
      DateFNS.compareAsc(timeA, timeB),
    );

    /*
     * TODO: New members AND members that haven't logged in a lot both have 1
     * sample, and we cannot differentiate them even though we'd like to display
     * new member's gains over a month/year. This is fairly minor, since this
     * only happens if the new member hasn't played enough to be logged multiple
     * times.
     */
    if (samplesSortedOldestFirst.length >= 2) {
      const startingSkills = samplesSortedOldestFirst.at(0)!.data;
      const endingSkills = samplesSortedOldestFirst.at(-1)!.data;

      const skillIndexMax = Math.max(startingSkills.length, endingSkills.length);
      for (let skillIndex = 0; skillIndex < skillIndexMax; skillIndex++) {
        const skill = SkillsInBackendOrder[skillIndex];
        if (options.skillFilter !== "Overall" && skill !== options.skillFilter) {
          continue;
        }

        const start = startingSkills.at(skillIndex) ?? 0;
        const end = endingSkills.at(skillIndex) ?? 0;
        const xpGain = Math.max(0, end - start) as Experience;

        memberGain.perSkill[skillIndex] = xpGain;
        memberGain.total = (memberGain.total + xpGain) as Experience;
        groupGainTotal = (groupGainTotal + xpGain) as Experience;
      }
    }

    groupGains.push(memberGain);
  }

  const rows: SkillGraphTableRow[] = [];

  groupGains.sort(({ total: a }, { total: b }) => b - a);

  for (const { name, total, perSkill, colorCSS } of groupGains) {
    if (options.skillFilter !== "Overall") {
      const skill: Skill = options.skillFilter;

      rows.push({
        name,
        colorCSS: `hsl(69deg, 60%, 60%)`,
        fillFraction: total / groupGainTotal,
        iconSource: SkillIconsBySkill.get(skill)!.href,
        quantity: total,
      });
      continue;
    }

    const overallFraction = total / groupGainTotal;
    const header: SkillGraphTableRow = {
      name,
      colorCSS,
      fillFraction: overallFraction,
      iconSource: SkillIconsBySkill.get("Overall")?.href ?? "",
      quantity: total,
    };
    const skillRows: SkillGraphTableRow[] = [];

    for (let skillIndex = 0; skillIndex < perSkill.length; skillIndex++) {
      const xpGain = perSkill.at(skillIndex);
      const skill = SkillsInBackendOrder[skillIndex];

      if (!xpGain || xpGain <= 0 || !skill) {
        continue;
      }

      const fraction = xpGain / total;

      skillRows.push({
        name: skill,
        colorCSS,
        fillFraction: fraction * overallFraction,
        iconSource: SkillIconsBySkill.get(skill)!.href,
        quantity: xpGain,
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
    options: buildLineChartOptions({ period: "Day", yAxisUnit: "Total experience", skillFilter: "Overall" }),
  });

  const [loading, setLoading] = useState<boolean>(true);
  const updateChartPromiseRef = useRef<Promise<void>>(undefined);

  const memberColors = useContext(GroupMemberColorsContext);

  const { fetchSkillData } = useContext(APIContext);

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
        // Filter and sort the data, so that calculations like xp/hr down the road are well formed.
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

        /*
         * Slice the data, since our calculations up until now included an extra
         * interval.
         *
         * For example, if today is JUNE 8 and the period is a week, we get
         * samples and process JUNE 1.
         *
         * This also makes "per hour" options well defined, since our
         * calculations look backwards to determine rates, and the first sample
         * can't look backwards.
         */
        const data = {
          datasets: buildDatasetsFromMemberSkillData(memberChartData, dates, {
            yAxisUnit,
            skillFilter,
          }).map(({ label, data, borderColor, backgroundColor }) => {
            return {
              label,
              borderColor,
              backgroundColor,
              data: data.slice(1),
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
          buildTableRowsFromMemberSkillData(memberChartData, {
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
    for (const { colorCSS, fillFraction, iconSource, name, quantity } of tableRowData) {
      const fillPercent = Math.max(0.1, Math.min(100, 100 * fillFraction));
      tableRowElements.push(
        <tr
          key={`${iconSource} ${name} ${quantity} ${fillFraction} ${colorCSS}`}
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
            src={SkillIconsBySkill.get(skillFilter)?.href ?? ""}
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
