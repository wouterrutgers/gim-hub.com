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
} from "../../components/skill-graph/skill-graph-data";
import { fetchSkillData, rangeForPeriod } from "../../api/requests/skill-data";
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
    const shorterRange = { ...range, start: new Date("2026-09-07T12:15:00Z") };
    expect(values(buildDatasetsFromMemberSkillData(data, shorterRange, options))).toEqual([0, 200, 200]);
    expect(buildTableRowsFromMemberSkillData(data, shorterRange, options)[0].quantity).toBe(200);
  });

  it("uses elapsed hours for irregular observations and visible duration for the table", function testRates() {
    const data = members([sample("11:55", 100), sample("12:10", 200), sample("12:30", 400)]);
    const options = { skillFilter: "Attack", yAxisUnit: "Experience per hour" };
    expect(values(buildDatasetsFromMemberSkillData(data, range, options))).toEqual([null, 400, 600, 0]);
    expect(buildTableRowsFromMemberSkillData(data, range, options)[0].quantity).toBe(300);
  });

  it("compares players at the same time without inventing earlier progress", function testSharedTimeline() {
    const data = [
      ...members([sample("11:55", 100), sample("12:10", 200), sample("12:30", 400)]),
      {
        ...members([sample("12:20", 100_000), sample("12:40", 100_200)])[0],
        member: "Bob",
      },
    ];
    const options = { skillFilter: "Attack", yAxisUnit: "Cumulative experience gained" };
    const datasets = buildDatasetsFromMemberSkillData(data, range, options);

    expect(
      datasets[0].data.map(function getTime(point) {
        return point.x;
      }),
    ).toEqual(
      datasets[1].data.map(function getTime(point) {
        return point.x;
      }),
    );
    expect(
      datasets.map(function getGains(dataset) {
        return dataset.data.map(function getValue(point) {
          return point.y;
        });
      }),
    ).toEqual([
      [0, 100, 100, 300, 300, 300],
      [null, null, 0, 0, 200, 200],
    ]);
    expect(
      buildDatasetsFromMemberSkillData(data, range, { ...options, yAxisUnit: "Experience per hour" }).map(
        function getRate(dataset) {
          return dataset.data.find(function atSharedTime(point) {
            return point.x === new Date("2026-09-07T12:40:00Z").getTime();
          }).y;
        },
      ),
    ).toEqual([400, 600]);
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
          ...rangeForPeriod(requestedRange.period),
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

    for (const button of container.querySelectorAll(".skill-graph-member-toggle")) {
      button.click();
    }

    [...container.querySelectorAll("#skill-graph-presets button")]
      .find(function isWeek(button) {
        return button.textContent === "7 days";
      })
      .click();
    await vi.advanceTimersByTimeAsync(0);
    await nextTick();

    expect(
      [...container.querySelectorAll("tbody tr")].map(function readRow(row) {
        return [row.querySelector(".skill-graph-row-name").textContent, Number(row.cells[1].textContent)];
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

it("loads and switches presets using server ranges when the browser clock is ahead", async function testServerClock() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-07T13:00:02Z"));
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async function fetchHistory(url) {
    const query = new URL(url, "https://example.test").searchParams;
    const period = query.get("period");

    return new Response(
      JSON.stringify({
        start: query.get("start") ?? (period === "Day" ? "2026-09-06T13:00:00Z" : "2026-08-31T13:00:00Z"),
        end: query.get("end") ?? "2026-09-07T13:00:00Z",
        earliest: "2026-08-31T13:00:00Z",
        members: [],
      }),
    );
  });
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
      return [];
    },
    fetchSkillData(requestedRange) {
      return fetchSkillData({ baseURL: "/api", credentials: { name: "group", token: "token" }, ...requestedRange });
    },
  };
  const container = document.createElement("div");
  createTestApplication(SkillGraph).use(pinia).mount(container);
  await vi.advanceTimersByTimeAsync(0);
  await nextTick();

  expect(new URL(fetch.mock.calls[0][0], "https://example.test").search).toBe("?period=Day");
  expect(container.querySelector("#skill-graph-range").textContent).toContain(
    new Date("2026-09-07T13:00:00Z").toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
  );
  expect(container.querySelector('[aria-label="Next period"]').disabled).toBe(true);

  container.querySelector('[aria-label="Previous period"]').click();
  await vi.advanceTimersByTimeAsync(0);
  await nextTick();

  expect(Object.fromEntries(new URL(fetch.mock.calls.at(-1)[0], "https://example.test").searchParams)).toEqual({
    start: "2026-09-05T13:00:00.000Z",
    end: "2026-09-06T13:00:00.000Z",
  });

  container.querySelector('[aria-label="Next period"]').click();
  await vi.advanceTimersByTimeAsync(0);
  await nextTick();

  expect(Object.fromEntries(new URL(fetch.mock.calls.at(-1)[0], "https://example.test").searchParams)).toEqual({
    start: "2026-09-06T13:00:00.000Z",
    end: "2026-09-07T13:00:00.000Z",
  });
  expect(container.querySelector('[aria-label="Next period"]').disabled).toBe(true);

  [...container.querySelectorAll("#skill-graph-presets button")]
    .find(function isWeek(button) {
      return button.textContent === "7 days";
    })
    .click();
  await vi.advanceTimersByTimeAsync(0);
  await nextTick();

  expect(new URL(fetch.mock.calls.at(-1)[0], "https://example.test").search).toBe("?period=Week");
  expect(container.querySelector("#skill-graph-range").textContent).toBe(
    `${new Date("2026-08-31T13:00:00Z").toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} to ${new Date("2026-09-07T13:00:00Z").toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
  );
  expect(container.querySelector('[aria-label="Previous period"]').disabled).toBe(true);
  expect(container.querySelector("#skill-graph-error")).toBeNull();
});

it("keeps demo history consistent across overlapping periods", async function testDemoNavigation() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-07T13:00:00Z"));
  const client = new DemoClient();
  const end = new Date();
  const day = await client.fetchSkillData({ period: "Day" });
  const all = await client.fetchSkillData({ period: "All" });
  expect(all.earliest < day.start).toBe(true);
  expect(all.members.get("Thurgo").length).toBeLessThanOrEqual(1502);
  expect(day.members.get("Thurgo").at(-1)).toEqual(all.members.get("Thurgo").at(-1));
  const hour = await client.fetchSkillData({ start: new Date(end.getTime() - 3600_000), end });
  expect(hour.members.get("Thurgo").at(-2)).toEqual(day.members.get("Thurgo").at(-2));
});
