import { setActivePinia } from "pinia";
import { describe, expect, it, vi } from "vite-plus/test";
import { createTestPinia } from "./vue-test-helpers";
import { useImageStore } from "../../stores/images";

describe("image store", function describeImageStore() {
  it("shares a chunk request between concurrent image lookups", async function testRequestDeduplication() {
    const fetchChunk = vi.fn(async function fetchChunk() {
      return {
        ok: true,
        async json() {
          return {
            "/icons/first.webp": "/hashed/icons/first.webp",
            "/icons/second.webp": "/hashed/icons/second.webp",
          };
        },
      };
    });
    vi.stubGlobal("fetch", fetchChunk);
    setActivePinia(createTestPinia());

    const imageStore = useImageStore();
    const [firstUrl, secondUrl] = await Promise.all([
      imageStore.getImageUrl("/icons/first.webp"),
      imageStore.getImageUrl("/icons/second.webp"),
    ]);

    expect(firstUrl).toBe("/hashed/icons/first.webp");
    expect(secondUrl).toBe("/hashed/icons/second.webp");
    expect(fetchChunk).toHaveBeenCalledOnce();
  });
});
