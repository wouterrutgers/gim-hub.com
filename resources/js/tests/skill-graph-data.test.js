// @vitest-environment jsdom

import { nextTick } from "vue";
import { describe, expect, it } from "vite-plus/test";
import { createTestApplication, createTestPinia } from "./vue-test-helpers";
import SkillGraph from "../../components/skill-graph/SkillGraph.vue";
import { useApiStore } from "../../stores/api";
import { useImageStore } from "../../stores/images";
import {
  buildDatasetsFromMemberSkillData,
  buildTableRowsFromMemberSkillData,
  rangeForPeriod,
} from "../../components/skill-graph/skill-graph-data";
import { fetchSkillData } from "../../api/requests/skill-data";
import DemoClient from "../../api/demo-client";
import { vi } from "vite-plus/test";

vi.mock("vue-chartjs", function stubChart() {
  return { Line: { render() {} } };
});

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

  it("keeps shared skills under the correct member when changing periods reorders rows", async function testRowOwnership() {
    function historySample(date, attack, cooking) {
      return {
        time: new Date(`${date}T13:00:00Z`),
        data: [0, attack, 0, cooking, ...new Array(20).fill(0)],
      };
    }
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T13:00:00Z"));
    const pinia = createTestPinia();
    vi.spyOn(useImageStore(pinia), "getImageUrl").mockResolvedValue("");
    useApiStore(pinia).client = {
      async fetchGameData() {
        return { quests: new Map() };
      },
      async fetchGroupCollectionLogs() {
        return new Map();
      },
      async fetchGroupData() {
        return [{ name: "Alice" }, { name: "Bob" }];
      },
      async fetchSkillData(requestedRange) {
        return {
          ...requestedRange,
          members: new Map([
            [
              "Alice",
              [
                historySample("2026-08-31", 0, 0),
                historySample("2026-09-06", 100, 300),
                historySample("2026-09-07", 400, 400),
              ],
            ],
            [
              "Bob",
              [
                historySample("2026-08-31", 0, 0),
                historySample("2026-09-06", 500, 100),
                historySample("2026-09-07", 600, 300),
              ],
            ],
          ]),
        };
      },
    };
    const container = document.createElement("div");
    const app = createTestApplication(SkillGraph).use(pinia);

    app.mount(container);
    await vi.advanceTimersByTimeAsync(0);
    await nextTick();

    [...container.querySelectorAll("#skill-graph-presets button")]
      .find(function isWeek(button) {
        return button.textContent === "Week";
      })
      .click();
    await vi.advanceTimersByTimeAsync(0);
    await nextTick();

    expect(
      [...container.querySelectorAll("tbody tr")].map(function readRow(row) {
        return [row.cells[0].textContent.trim(), Number(row.cells[1].textContent)];
      }),
    ).toEqual([
      ["Bob", 900],
      ["Attack", 600],
      ["Cooking", 300],
      ["Alice", 800],
      ["Attack", 400],
      ["Cooking", 400],
    ]);
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
  const result = await fetchSkillData({ baseURL: "/api", credentials: { name: "group", token: "token" }, ...range });
  const query = new URL(fetch.mock.calls[0][0], "https://example.test").searchParams;
  expect(query.get("start")).toBe(range.start.toISOString());
  expect(query.get("end")).toBe(range.end.toISOString());
  expect(result.members.get("Alice")[0].time).toEqual(range.start);
  expect(result.start).toEqual(range.start);
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
