import { describe, expect, it, vi } from "vite-plus/test";
import { fetchActivity, fetchPlayerActivity } from "../../api/requests/activity";

describe("activity requests", function activityRequests() {
  it("requests complete player periods with the selected timezone and independent history cursor", async function playerPeriods() {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ periods: [], older_cursor: null, from_time: "2026-11-09T12:00:00Z" }));
    vi.stubGlobal("fetch", fetch);

    await fetchPlayerActivity({
      baseURL: "/api",
      credentials: { name: "Test group", token: "secret" },
      memberIdentifier: 10,
      timezone: "Europe/Amsterdam",
      cursor: "day:1794182400000",
    });

    const [url, options] = fetch.mock.calls[0];
    const request = new URL(url, "http://localhost");
    expect(request.pathname).toBe("/api/group/Test%20group/activity/player/10");
    expect(request.searchParams.get("timezone")).toBe("Europe/Amsterdam");
    expect(request.searchParams.get("cursor")).toBe("day:1794182400000");
    expect(options.headers.Authorization).toBe("secret");
  });

  it("sends group authentication and independent history and update cursors", async function requestActivity() {
    const fetch = vi.fn(function response() {
      return Response.json({
        entries: [
          {
            id: 1,
            member_id: 1,
            revision: 1,
            type: "xp",
            is_weekly: true,
            started_at: Date.parse("2026-09-07"),
            occurred_at: Date.parse("2026-09-13"),
            data: { skills: { Attack: 250 } },
          },
        ],
        older_cursor: null,
        from_time: "2026-10-14T09:00:00.000Z",
      });
    });
    vi.stubGlobal("fetch", fetch);
    const activity = await fetchActivity({
      baseURL: "/api",
      credentials: { name: "Test group", token: "secret" },
      cursor: "a+b/c=",
    });
    expect(activity.entries[0].is_weekly).toBe(true);
    const [url, options] = fetch.mock.calls[0];
    expect(new URL(url, "http://localhost").searchParams.get("cursor")).toBe("a+b/c=");
    expect(options.headers.Authorization).toBe("secret");
    await fetchActivity({
      baseURL: "/api",
      credentials: { name: "Test group", token: "secret" },
      fromTime: "2026-10-14T09:00:00.000Z",
    });
    expect(new URL(fetch.mock.calls[1][0], "http://localhost").searchParams.get("from_time")).toBe(
      "2026-10-14T09:00:00.000Z",
    );
  });
});
