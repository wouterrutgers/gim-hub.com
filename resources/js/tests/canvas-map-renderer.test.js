// @vitest-environment jsdom

import { setActivePinia } from "pinia";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vite-plus/test";
import CanvasMap from "../../components/canvas-map/CanvasMap.vue";
import { CanvasMapRenderer } from "../../components/canvas-map/canvas-map-renderer";
import { Pos2D } from "../../components/canvas-map/coordinates";
import { createTestApplication, createTestPinia } from "./vue-test-helpers";

function fakeImageLoading() {
  const bitmaps = [];
  vi.stubGlobal(
    "Image",
    class FakeImage {
      set src(source) {
        this.source = source;
        queueMicrotask(this.onload);
      }

      get src() {
        return this.source;
      }
    },
  );
  const createBitmap = vi.fn(async function decodeImage(image) {
    const bitmap = { source: image.src, close: vi.fn() };
    bitmaps.push(bitmap);

    return bitmap;
  });
  vi.stubGlobal("createImageBitmap", createBitmap);

  return { bitmaps, createBitmap };
}

function createRenderer() {
  const renderer = new CanvasMapRenderer(async function getImageUrl(path) {
    return path;
  });
  renderer.processMapData({ icons: {}, labels: {}, labelNames: {} });

  return renderer;
}

function createRegionContext(min, max) {
  return {
    getVisibleWorldBox() {
      return {
        min: Pos2D.regionToWorld({ x: min.x, y: max.y }),
        max: Pos2D.regionToWorld({ x: max.x, y: min.y }),
      };
    },
    drawRect: vi.fn(),
    drawImageSnappedToGrid: vi.fn(),
  };
}

async function settleImageLoads() {
  await new Promise(function settle(resolve) {
    setImmediate(resolve);
  });
}

async function loadRegion(renderer, x, y) {
  const context = createRegionContext({ x, y }, { x: x + 1, y: y + 1 });
  renderer.loadVisibleAll(context);
  await settleImageLoads();

  return context;
}

async function visitRegions(renderer) {
  for (let index = 0; index < 300; index++) {
    await loadRegion(renderer, 18 + (index % 30), 19 + Math.floor(index / 30));
  }
}

function mountMap() {
  const pinia = createTestPinia();
  setActivePinia(pinia);
  document.body.innerHTML = '<div id="test-canvas-map"></div>';
  const application = createTestApplication(CanvasMap, { interactive: true });
  application.use(pinia);
  application.mount("#test-canvas-map");

  return application;
}

describe("map touch navigation", function describeTouchNavigation() {
  it("pinches around the touch midpoint and resumes dragging when a finger lifts", async function testPinchZoom() {
    const clock = vi.spyOn(performance, "now").mockReturnValue(1000);
    const renderer = createRenderer();
    renderer.camera.position = { x: 0, y: 0 };
    vi.spyOn(CanvasMapRenderer, "load").mockResolvedValue(renderer);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      canvas: { width: 800, height: 600, clientWidth: 800, clientHeight: 600 },
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
    });
    const scheduleFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", scheduleFrame);
    mountMap();
    await settleImageLoads();
    await nextTick();
    const canvas = document.getElementById("canvas-map");

    function dispatchTouch(type, pointerId, clientX, clientY) {
      canvas.dispatchEvent(new PointerEvent(type, { pointerId, pointerType: "touch", clientX, clientY }));
    }

    function renderFrame() {
      clock.mockReturnValue(performance.now() + 16);
      scheduleFrame.mock.lastCall[0]();
    }

    dispatchTouch("pointerdown", 1, 100, 200);
    dispatchTouch("pointerdown", 2, 300, 200);
    dispatchTouch("pointermove", 2, 500, 200);
    renderFrame();

    expect(renderer.camera.zoom).toBe(0.125);
    expect(renderer.camera.position).toEqual({ x: -37.5, y: -12.5 });

    dispatchTouch("pointermove", 2, 300, 200);
    renderFrame();

    expect(renderer.camera.zoom).toBe(0.25);
    expect(renderer.camera.position).toEqual({ x: 0, y: 0 });

    dispatchTouch("pointerup", 2, 300, 200);
    dispatchTouch("pointerleave", 2, 300, 200);
    renderFrame();

    expect(renderer.camera.position).toEqual({ x: 0, y: 0 });

    dispatchTouch("pointermove", 1, 120, 210);
    renderFrame();

    expect(renderer.camera.position).toEqual({ x: -5, y: -2.5 });

    dispatchTouch("pointercancel", 1, 120, 210);
    dispatchTouch("pointerdown", 3, 500, 200);
    dispatchTouch("pointermove", 3, 520, 200);
    renderFrame();

    expect(renderer.camera.zoom).toBe(0.25);
    expect(renderer.camera.position).toEqual({ x: -10, y: -2.5 });
  });
});

describe("map bitmap lifetime", function describeBitmapLifetime() {
  it("bounds retained tiles while reusing recent views and reloading evicted views", async function testTileEviction() {
    const { bitmaps, createBitmap } = fakeImageLoading();
    const renderer = createRenderer();

    for (let index = 0; index < 300; index++) {
      await loadRegion(renderer, 18 + (index % 30), 19 + Math.floor(index / 30));

      if (index === 150) {
        await loadRegion(renderer, 18, 19);
      }
    }

    await loadRegion(renderer, 18, 19);

    expect(createBitmap).toHaveBeenCalledTimes(300);
    expect(bitmaps[0].close).not.toHaveBeenCalled();
    expect(bitmaps[1].close).toHaveBeenCalledOnce();
    expect(
      bitmaps.filter(function isRetained(bitmap) {
        return bitmap.close.mock.calls.length === 0;
      }),
    ).toHaveLength(256);

    const context = await loadRegion(renderer, 19, 19);
    renderer.drawVisibleRegions(context);

    expect(createBitmap).toHaveBeenCalledTimes(301);
    expect(context.drawImageSnappedToGrid).toHaveBeenCalledWith(expect.objectContaining({ image: bitmaps.at(-1) }));
    expect(bitmaps.at(-1).close).not.toHaveBeenCalled();
  });

  it("keeps every visible tile in a wide view and releases tiles from the previous plane", async function testVisibleTiles() {
    const { bitmaps } = fakeImageLoading();
    const renderer = createRenderer();
    const context = createRegionContext({ x: 18, y: 19 }, { x: 35, y: 35 });

    for (let frame = 0; frame < 12; frame++) {
      renderer.loadVisibleAll(context);
      await settleImageLoads();
    }

    renderer.drawVisibleRegions(context);

    expect(context.drawImageSnappedToGrid).toHaveBeenCalledTimes(272);

    for (const bitmap of bitmaps) {
      expect(bitmap.close).not.toHaveBeenCalled();
    }

    const previousPlaneBitmaps = [...bitmaps];
    renderer.setPlane(1);

    for (let frame = 0; frame < 12; frame++) {
      renderer.loadVisibleAll(context);
      await settleImageLoads();
    }

    for (const bitmap of previousPlaneBitmaps) {
      expect(bitmap.close).toHaveBeenCalledOnce();
    }
  });

  it("closes a late bitmap without replacing a newly loaded tile at the same location", async function testLateTileLoad() {
    const { bitmaps, createBitmap } = fakeImageLoading();
    const renderer = createRenderer();
    const lateBitmap = { close: vi.fn() };
    let finishDecode;
    createBitmap.mockImplementationOnce(function delayDecode() {
      return new Promise(function captureDecode(resolve) {
        finishDecode = resolve;
      });
    });

    await visitRegions(renderer);
    const context = await loadRegion(renderer, 18, 19);
    const replacementBitmap = bitmaps.at(-1);
    finishDecode(lateBitmap);
    await settleImageLoads();
    renderer.drawVisibleRegions(context);

    expect(lateBitmap.close).toHaveBeenCalledOnce();
    expect(context.drawImageSnappedToGrid).toHaveBeenCalledWith(expect.objectContaining({ image: replacementBitmap }));
    expect(replacementBitmap.close).not.toHaveBeenCalled();
  });

  it("releases tile, label and atlas bitmaps on unmount, including a label that finishes later", async function testUnmount() {
    const { bitmaps, createBitmap } = fakeImageLoading();
    const renderer = createRenderer();
    renderer.processMapData({
      icons: {},
      labels: { 18: { 19: { 0: [1100, 1230, 1, 1110, 1240, 2] } } },
      labelNames: { 1: "First location", 2: "Second location" },
    });
    const decodeImage = createBitmap.getMockImplementation();
    let finishLabelDecode;
    const lateLabelBitmap = { close: vi.fn() };
    createBitmap.mockImplementation(function decodeLabel(image) {
      if (image.src === "/map-misc/2.webp") {
        return new Promise(function captureLabelDecode(resolve) {
          finishLabelDecode = resolve;
        });
      }

      return decodeImage(image);
    });
    renderer.iconsAtlas = { close: vi.fn() };
    await loadRegion(renderer, 18, 19);
    vi.spyOn(CanvasMapRenderer, "load").mockResolvedValue(renderer);
    vi.spyOn(renderer, "update").mockImplementation(function skipCanvasDrawing() {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({});
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    const application = mountMap();
    await settleImageLoads();
    await nextTick();

    application.unmount();
    finishLabelDecode(lateLabelBitmap);
    await settleImageLoads();

    expect(bitmaps).toHaveLength(2);

    for (const bitmap of bitmaps) {
      expect(bitmap.close).toHaveBeenCalledOnce();
    }

    expect(renderer.iconsAtlas.close).toHaveBeenCalledOnce();
    expect(lateLabelBitmap.close).toHaveBeenCalledOnce();
  });

  it("releases a renderer that initializes after its map has unmounted", async function testLateInitialization() {
    const renderer = createRenderer();
    renderer.iconsAtlas = { close: vi.fn() };
    let finishInitialization;
    vi.spyOn(CanvasMapRenderer, "load").mockReturnValue(
      new Promise(function captureInitialization(resolve) {
        finishInitialization = resolve;
      }),
    );
    const application = mountMap();

    application.unmount();
    finishInitialization(renderer);
    await settleImageLoads();

    expect(renderer.iconsAtlas.close).toHaveBeenCalledOnce();
  });
});
