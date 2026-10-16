import { describe, expect, it, vi } from "vite-plus/test";
import { fetchActivity } from "../../api/requests/activity";

describe("activity requests", function activityRequests() {
  it("sends group authentication and independent history and update cursors", async function requestActivity() {
    const fetch = vi.fn(function response() {
      return Response.json({
        entries: [],
        older_cursor: null,
        from_time: "2026-10-14T09:00:00.000Z",
      });
    });
    vi.stubGlobal("fetch", fetch);
    await fetchActivity({ baseURL: "/api", credentials: { name: "Test group", token: "secret" }, cursor: "a+b/c=" });
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
