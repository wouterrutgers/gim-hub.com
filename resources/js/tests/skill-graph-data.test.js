import { describe, expect, it } from "vite-plus/test";
import {
  buildDatasetsFromMemberSkillData,
  buildTableRowsFromMemberSkillData,
  rangeForPeriod,
} from "../../components/skill-graph/skill-graph-data";
import { fetchSkillData } from "../../api/requests/skill-data";
import DemoClient from "../../api/demo-client";
import { vi } from "vite-plus/test";

function sample(time, experience) {
  return { time: new Date(`2026-09-07T${time}:00Z`), data: [0, experience, ...new Array(22).fill(0)] };
}
function members(samples) {
  return [
    {
      member: "Alice",
      skillSamples: samples,
      style: { lineBorder: "red", lineBackground: "red", barBackground: "red" },
    },
  ];
}
const range = { start: new Date("2026-09-07T12:00:00Z"), end: new Date("2026-09-07T13:00:00Z") };

function values(datasets) {
  return datasets[0].data.map(function getValue(point) {
    return point.y;
  });
}

describe("skill history calculations", function describeCalculations() {
  it("rebases gains and totals to the visible window", function testRebase() {
    const data = members([sample("11:55", 100), sample("12:10", 200), sample("12:30", 400)]);
    const options = { skillFilter: "Attack", yAxisUnit: "Cumulative experience gained" };
    expect(values(buildDatasetsFromMemberSkillData(data, range, options))).toEqual([0, 100, 300, 300]);
    expect(buildTableRowsFromMemberSkillData(data, range, options)[0].quantity).toBe(300);
    const zoomed = { ...range, start: new Date("2026-09-07T12:15:00Z") };
    expect(values(buildDatasetsFromMemberSkillData(data, zoomed, options))).toEqual([0, 200, 200]);
    expect(buildTableRowsFromMemberSkillData(data, zoomed, options)[0].quantity).toBe(200);
  });

  it("uses elapsed hours for irregular observations and visible duration for the table", function testRates() {
    const data = members([sample("11:55", 100), sample("12:10", 200), sample("12:30", 400)]);
    const options = { skillFilter: "Attack", yAxisUnit: "Experience per hour" };
    expect(values(buildDatasetsFromMemberSkillData(data, range, options))).toEqual([null, 400, 600, 0]);
    expect(buildTableRowsFromMemberSkillData(data, range, options)[0].quantity).toBe(300);
  });

  it("does not count a new member's existing experience as gains", function testMissingBaseline() {
    const data = members([sample("12:10", 100_000), sample("12:30", 100_200)]);
    const options = { skillFilter: "Attack", yAxisUnit: "Cumulative experience gained" };
    const datasets = buildDatasetsFromMemberSkillData(data, range, options);
    expect(datasets[0].data[0].x).toBe(new Date("2026-09-07T12:10:00Z").getTime());
    expect(values(datasets)).toEqual([0, 200, 200]);
    expect(buildTableRowsFromMemberSkillData(data, range, options)[0].quantity).toBe(200);
  });

  it("carries inactive totals forward and excludes observations after the visible end", function testInactive() {
    const data = members([sample("11:00", 100), sample("13:30", 999)]);
    expect(
      values(buildDatasetsFromMemberSkillData(data, range, { skillFilter: "Attack", yAxisUnit: "Total experience" })),
    ).toEqual([100, 100]);
    expect(
      buildTableRowsFromMemberSkillData(data, range, {
        skillFilter: "Attack",
        yAxisUnit: "Cumulative experience gained",
      })[0].quantity,
    ).toBe(0);
  });

  it("produces no values before the first observation", function testEmptyRange() {
    const data = members([sample("13:30", 999)]);
    const options = { skillFilter: "Overall", yAxisUnit: "Total experience" };
    expect(values(buildDatasetsFromMemberSkillData(data, range, options))).toEqual([]);
    expect(buildTableRowsFromMemberSkillData(data, range, options)).toEqual([]);
  });

  it("uses calendar periods in UTC including across daylight saving changes", function testPresets() {
    const end = new Date("2026-03-30T12:00:00Z");
    expect(rangeForPeriod("Day", end).start.toISOString()).toBe("2026-03-29T12:00:00.000Z");
    expect(rangeForPeriod("Month", end).start.toISOString()).toBe("2026-02-28T12:00:00.000Z");
    expect(rangeForPeriod("All", end)).toEqual({ start: undefined, end });
  });
});

it("sends explicit dates and decodes skill history from the live response", async function testLiveContract() {
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        earliest: range.start.toISOString(),
        members: [{ name: "Alice", skill_data: [{ time: range.start.toISOString(), data: new Array(24).fill(100) }] }],
      }),
    ),
  );
  try {
    const result = await fetchSkillData({ baseURL: "/api", credentials: { name: "group", token: "token" }, ...range });
    const query = new URL(fetch.mock.calls[0][0], "https://example.test").searchParams;
    expect(query.get("start")).toBe(range.start.toISOString());
    expect(query.get("end")).toBe(range.end.toISOString());
    expect(result.members.get("Alice")[0].time).toEqual(range.start);
    expect(result.start).toEqual(range.start);
  } finally {
    fetch.mockRestore();
  }
});

it("keeps demo history consistent when zooming into a larger period", async function testDemoNavigation() {
  const client = new DemoClient();
  const end = new Date();
  const day = await client.fetchSkillData(rangeForPeriod("Day", end));
  const all = await client.fetchSkillData(rangeForPeriod("All", end));
  expect(all.earliest < day.start).toBe(true);
  expect(all.members.get("Thurgo").length).toBeLessThanOrEqual(1502);
  expect(day.members.get("Thurgo").at(-1)).toEqual(all.members.get("Thurgo").at(-1));
  const zoomed = await client.fetchSkillData({ start: new Date(end.getTime() - 3600_000), end });
  expect(zoomed.members.get("Thurgo").at(-2)).toEqual(day.members.get("Thurgo").at(-2));
});
