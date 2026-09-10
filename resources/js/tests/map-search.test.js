// @vitest-environment jsdom

import { createRequire } from "node:module";
import { createPinia, disposePinia, setActivePinia } from "pinia";
import { createApp, nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import MapSearch from "../../components/canvas-map/MapSearch.vue";
import { CanvasMapRenderer } from "../../components/canvas-map/canvas-map-renderer";
import { Context2DScaledWrapper } from "../../components/canvas-map/canvas-wrapper";
import { fetchMapData } from "../../game/map-data";
import { useMapStore } from "../../stores/map";

const { buildMapLabels } = createRequire(import.meta.url)("../../../cache/map-labels.js");

let application;
let pinia;

function mountSearch() {
  pinia = createPinia();
  setActivePinia(pinia);
  document.body.innerHTML = '<div id="test-map-search"></div><button id="outside">Outside</button>';
  application = createApp(MapSearch);
  application.use(pinia);
  application.mount("#test-map-search");
  return useMapStore();
}

async function loadLabels(labels) {
  const mapData = { icons: {}, tiles: [[], [], [], []], ...buildMapLabels(labels) };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      async json() {
        return mapData;
      },
    }),
  );
  const renderer = new CanvasMapRenderer(vi.fn().mockResolvedValue(undefined));
  renderer.processMapData(await fetchMapData());
  renderer.setInteractive(true);
  useMapStore().setRenderer(renderer);
  await nextTick();
  return renderer;
}

async function searchFor(value) {
  const input = document.querySelector('[role="combobox"]');
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await nextTick();
  return input;
}

function suggestedNames() {
  return [...document.querySelectorAll('[role="option"] span')].map(function getName(option) {
    return option.textContent;
  });
}

function createMapContext() {
  return new Context2DScaledWrapper({
    pixelRatio: 1,
    context: {
      canvas: { width: 800, height: 600, clientWidth: 800, clientHeight: 600 },
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
    },
  });
}

describe("map search", function describeMapSearch() {
  afterEach(function cleanup() {
    application.unmount();
    disposePinia(pinia);
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("waits for map data before offering searchable, ranked labels", async function testRankedSuggestions() {
    mountSearch();
    expect(document.querySelector('[role="combobox"]').disabled).toBe(true);
    await loadLabels([
      [3200, 3400, 0, "West Varrock"],
      [3210, 3420, 0, "Varrock palace"],
      [3220, 3430, 0, "Varrock"],
      [3230, 3440, 0, " Varrock<br>  east bank "],
      [3240, 3450, 0, "Lumbridge"],
    ]);

    await searchFor(" vArRoCk ");

    expect(document.querySelector('[role="combobox"]').disabled).toBe(false);
    expect(suggestedNames()).toEqual(["Varrock", "Varrock east bank", "Varrock palace", "West Varrock"]);
  });

  it("limits one-character suggestions to eight and handles empty and unmatched input", async function testSearchLimits() {
    mountSearch();
    await loadLabels(
      Array.from({ length: 10 }, function makeLocation(_, index) {
        return [3200 + index, 3400, 0, `Location ${index}`];
      }),
    );

    await searchFor("l");
    expect(suggestedNames()).toHaveLength(8);

    await searchFor("   ");
    expect(document.querySelector('[role="listbox"]')).toBeNull();

    const input = await searchFor("missing");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(suggestedNames()).toHaveLength(0);
    expect(document.querySelector('[role="status"]')).not.toBeNull();
    expect(useMapStore().renderer.selectedLocation).toBeUndefined();
  });

  it("jumps to the selected duplicate on its plane and stops following and camera drift", async function testLocationJump() {
    mountSearch();
    const renderer = await loadLabels([
      [3200, 3400, 0, "Castle"],
      [2500, 9600, 2, "Castle"],
    ]);
    renderer.tryUpdatePlayerPositions(
      [{ label: "Player", coords: { x: 3100, y: 3200 }, plane: 0 }],
      new Set(["Player"]),
    );
    renderer.startFollowingPlayer({ player: "Player" });
    renderer.cursor.rateSamples = [{ x: 10, y: 5 }];
    renderer.cursor.accumulatedScroll = 100;
    const input = await searchFor("castle");
    const options = document.querySelectorAll('[role="option"]');
    expect(
      [...options].map(function getCoordinates(option) {
        return option.querySelector("small").textContent;
      }),
    ).toEqual(expect.arrayContaining([expect.stringContaining("3200"), expect.stringContaining("9601")]));

    [...options]
      .find(function isUndergroundLocation(option) {
        return option.textContent.includes("9601");
      })
      .click();
    await nextTick();

    expect(input.value).toBe("Castle");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(renderer.camera.followPlayer).toBeUndefined();
    expect(renderer.plane).toBe(2);
    expect(renderer.camera.position).toEqual({ x: 2500, y: -9601 });

    const context = {
      getCamera() {
        return { scale: renderer.camera.zoom, translation: renderer.camera.position };
      },
      getCanvasExtent() {
        return { x: 800, y: 600 };
      },
      drawRect: vi.fn(),
    };
    renderer.updateCamera({ context, elapsed: 16 });
    expect(renderer.camera.position).toEqual({ x: 2500, y: -9601 });
    expect(renderer.camera.zoom).toBe(0.125);
    renderer.drawSelectedLocation(context);
    expect(context.drawRect).toHaveBeenCalledWith(
      expect.objectContaining({
        rect: { min: { x: 2499, y: -9602 }, max: { x: 2501, y: -9600 } },
      }),
    );
    context.drawRect.mockClear();
    renderer.setPlane(0);
    renderer.drawSelectedLocation(context);
    expect(context.drawRect).not.toHaveBeenCalled();

    await searchFor("cast");
    expect(renderer.selectedLocation).toBeUndefined();
    document.querySelector('[role="option"]').click();
    renderer.startFollowingPlayer({ player: "Player" });
    expect(renderer.selectedLocation).toBeUndefined();
  });

  it("supports keyboard selection while keeping focus in the search field", async function testKeyboardSelection() {
    mountSearch();
    const renderer = await loadLabels([
      [3200, 3400, 0, "Varrock"],
      [3210, 3420, 0, "Varrock palace"],
    ]);
    const input = await searchFor("var");
    for (const option of document.querySelectorAll('[role="option"]')) {
      option.parentElement.scrollIntoView = vi.fn();
    }

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await nextTick();
    expect(document.getElementById(input.getAttribute("aria-activedescendant")).textContent).toContain(
      "Varrock palace",
    );
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    await nextTick();
    expect(document.getElementById(input.getAttribute("aria-activedescendant")).textContent.trim()).toBe("Varrock");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await nextTick();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await nextTick();

    expect(renderer.selectedLocation.name).toBe("Varrock palace");
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute("aria-activedescendant")).toBeNull();

    input.blur();
    input.focus();
    await nextTick();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await nextTick();
    expect(renderer.selectedLocation.name).toBe("Varrock palace");
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("pans and zooms together towards a nearby result", async function testNearbyLocationAnimation() {
    mountSearch();
    const clock = vi.spyOn(performance, "now").mockReturnValue(1000);
    const renderer = await loadLabels([[3320, 3399, 0, "Nearby location"]]);
    renderer.camera.position = { x: 3200, y: -3400 };
    const context = createMapContext();
    await searchFor("nearby");

    document.querySelector('[role="option"]').click();
    expect(renderer.camera.position).toEqual({ x: 3200, y: -3400 });
    clock.mockReturnValue(1075);
    renderer.update(context);
    expect(renderer.camera.position.x).toBeGreaterThan(3200);
    expect(renderer.camera.position.x).toBeLessThan(3320);
    expect(renderer.camera.zoom).toBeGreaterThan(0.125);
    expect(renderer.camera.zoom).toBeLessThan(0.25);
    const firstPosition = renderer.camera.position.x;
    const firstZoom = renderer.camera.zoom;
    clock.mockReturnValue(1150);
    renderer.update(context);
    expect(renderer.camera.position.x).toBeGreaterThan(firstPosition);
    expect(renderer.camera.position.x).toBeLessThan(3320);
    expect(renderer.camera.zoom).toBeGreaterThan(0.125);
    expect(renderer.camera.zoom).toBeLessThan(firstZoom);
    clock.mockReturnValue(1300);
    renderer.update(context);
    expect(renderer.camera.position).toEqual({ x: 3320, y: -3400 });
    expect(renderer.camera.zoom).toBe(0.125);
  });

  it.each([
    { distance: 1500, zoom: 0.25, plane: 0, animates: true },
    { distance: 1501, zoom: 0.25, plane: 0, animates: false },
    { distance: 1501, zoom: 0.5, plane: 0, animates: true },
    { distance: 1, zoom: 0.25, plane: 1, animates: false },
    { distance: 1000, zoom: 1.5, plane: 0, animates: true },
    { distance: 188, zoom: 0.03125, plane: 0, animates: false },
  ])(
    "chooses whether to pan for $distance tiles at zoom $zoom on plane $plane",
    async function testAnimationDistance({ distance, zoom, plane, animates }) {
      mountSearch();
      const renderer = await loadLabels([[3200 + distance, 3399, plane, "Destination"]]);
      renderer.camera.position = { x: 3200, y: -3400 };
      renderer.camera.zoom = zoom;
      await searchFor("destination");

      document.querySelector('[role="option"]').click();

      expect(renderer.camera.position.x).toBe(animates ? 3200 : 3200 + distance);
      expect(renderer.camera.zoom).toBe(animates ? zoom : 0.125);
      expect(renderer.plane).toBe(plane);
    },
  );

  it("lets dragging interrupt a location pan", async function testInterruptedLocationAnimation() {
    mountSearch();
    const clock = vi.spyOn(performance, "now").mockReturnValue(1000);
    const renderer = await loadLabels([[3320, 3399, 0, "Nearby location"]]);
    renderer.camera.position = { x: 3200, y: -3400 };
    const context = createMapContext();
    await searchFor("nearby");
    document.querySelector('[role="option"]').click();
    clock.mockReturnValue(1150);
    renderer.update(context);
    const position = { ...renderer.camera.position };
    const zoom = renderer.camera.zoom;

    renderer.handlePointerDown();
    clock.mockReturnValue(1166);
    renderer.update(context);
    renderer.handlePointerUp();
    clock.mockReturnValue(1400);
    renderer.update(context);

    expect(renderer.camera.position).toEqual(position);
    expect(renderer.camera.zoom).toBe(zoom);
  });

  it("lets scrolling interrupt the automatic pan and zoom", async function testScrollDuringLocationAnimation() {
    mountSearch();
    const clock = vi.spyOn(performance, "now").mockReturnValue(1000);
    const renderer = await loadLabels([[3320, 3399, 0, "Nearby location"]]);
    renderer.camera.position = { x: 3200, y: -3400 };
    const context = createMapContext();
    await searchFor("nearby");
    document.querySelector('[role="option"]').click();
    clock.mockReturnValue(1150);
    renderer.update(context);
    const zoomBeforeScroll = renderer.camera.zoom;

    renderer.handleScroll(30);
    clock.mockReturnValue(1166);
    renderer.update(context);
    const position = { ...renderer.camera.position };
    const zoom = renderer.camera.zoom;
    expect(zoom).toBeGreaterThan(zoomBeforeScroll);
    clock.mockReturnValue(1400);
    renderer.update(context);

    expect(renderer.camera.position).toEqual(position);
    expect(renderer.camera.zoom).toBe(zoom);
  });

  it("restores context when searching from an extreme close-up", async function testCloseUpLocationZoom() {
    mountSearch();
    const clock = vi.spyOn(performance, "now").mockReturnValue(1000);
    const renderer = await loadLabels([[3200, 3399, 0, "Current location"]]);
    renderer.camera.position = { x: 3200, y: -3400 };
    renderer.camera.zoom = 0.03125;
    const context = createMapContext();
    await searchFor("current");

    document.querySelector('[role="option"]').click();
    clock.mockReturnValue(1150);
    renderer.update(context);
    expect(renderer.camera.zoom).toBeGreaterThan(0.03125);
    expect(renderer.camera.zoom).toBeLessThan(0.125);
    clock.mockReturnValue(1300);
    renderer.update(context);

    expect(renderer.camera.position).toEqual({ x: 3200, y: -3400 });
    expect(renderer.camera.zoom).toBe(0.125);
  });

  it("dismisses suggestions with Escape, outside interaction and focus leaving the search", async function testDismissal() {
    mountSearch();
    await loadLabels([[3200, 3400, 0, "Varrock"]]);
    const input = await searchFor("var");

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await nextTick();
    expect(input.getAttribute("aria-expanded")).toBe("false");

    await searchFor("var");
    document.getElementById("outside").dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await nextTick();
    expect(input.getAttribute("aria-expanded")).toBe("false");

    await searchFor("var");
    document.getElementById("outside").focus();
    await nextTick();
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(useMapStore().renderer.selectedLocation).toBeUndefined();
  });
});
