<script setup>
  import { onBeforeUnmount, onMounted, ref, watch } from "vue";
  import { useGroupStore } from "../../stores/group";
  import { useImageStore } from "../../stores/images";
  import { useMapStore } from "../../stores/map";
  import { CanvasMapRenderer } from "./canvas-map-renderer";
  import { Context2DScaledWrapper } from "./canvas-wrapper";
  import { Vec2D } from "./coordinates";
  import "./canvas-map.css";

  const props = defineProps({
    interactive: { type: Boolean, required: true },
  });

  const groupStore = useGroupStore();
  const imageStore = useImageStore();
  const mapStore = useMapStore();

  const canvas = ref(null);

  let pixelRatio = 1;
  let animationFrameHandle;

  onMounted(function initializeCanvasMap() {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    canvas.value.addEventListener("wheel", handleWheel, { passive: false });
    CanvasMapRenderer.load(imageStore.getImageUrl).then(
      function storeRenderer(mapRenderer) {
        mapStore.setRenderer(mapRenderer);
      },
      function reportRendererError(reason) {
        console.error("Failed to build renderer:", reason);
      },
    );
  });

  onBeforeUnmount(function cleanupCanvasMap() {
    window.removeEventListener("resize", resizeCanvas);
    canvas.value?.removeEventListener("wheel", handleWheel);
    window.cancelAnimationFrame(animationFrameHandle);
    mapStore.setRenderer(undefined);
  });

  function resizeCanvas() {
    if (!canvas.value) {
      return;
    }

    pixelRatio = window.devicePixelRatio;
    canvas.value.width = Math.max(canvas.value.offsetWidth * pixelRatio, 1);
    canvas.value.height = Math.max(canvas.value.offsetHeight * pixelRatio, 1);

    if (mapStore.renderer) {
      mapStore.renderer.forceRenderNextFrame = true;
      mapStore.renderer.update(createContext());
    }
  }

  function createContext() {
    return new Context2DScaledWrapper({ pixelRatio, context: canvas.value.getContext("2d") });
  }

  function render() {
    if (!canvas.value || !mapStore.renderer) {
      return;
    }

    mapStore.renderer.update(createContext());
    animationFrameHandle = window.requestAnimationFrame(render);
  }

  function handleWheel(event) {
    event.preventDefault();
    mapStore.renderer?.handleScroll(event.deltaY);
  }

  function handlePointerMove({ clientX, clientY }) {
    mapStore.renderer?.handlePointerMove(Vec2D.create({ x: clientX, y: clientY }));
  }

  watch(
    [
      function getRenderer() {
        return mapStore.renderer;
      },
      function getMemberCoordinates() {
        return mapStore.memberCoordinates;
      },
      function getMemberNames() {
        return groupStore.memberNames;
      },
    ],
    function updatePlayerPositions([mapRenderer, positions, members]) {
      mapRenderer?.tryUpdatePlayerPositions(positions, members);
    },
    { immediate: true },
  );

  watch(
    [
      function getRenderer() {
        return mapStore.renderer;
      },
      function isInteractive() {
        return props.interactive;
      },
    ],
    function updateInteractive([mapRenderer, interactive]) {
      mapRenderer?.setInteractive(interactive);
    },
    { immediate: true },
  );

  watch(
    function getRenderer() {
      return mapStore.renderer;
    },
    function connectRendererCallbacks(mapRenderer, previousRenderer) {
      if (previousRenderer) {
        previousRenderer.onHoveredCoordinatesUpdate = undefined;
        previousRenderer.onDraggingUpdate = undefined;
        previousRenderer.onFollowPlayerUpdate = undefined;
        previousRenderer.onVisiblePlaneUpdate = undefined;
      }

      if (!mapRenderer) {
        return;
      }

      mapRenderer.onHoveredCoordinatesUpdate = function updateCoordinates(value) {
        mapStore.coordinates = value;
      };
      mapRenderer.onDraggingUpdate = function updateDragging(value) {
        mapStore.dragging = value;
      };
      mapRenderer.onFollowPlayerUpdate = function updateFollowedPlayer(value) {
        mapStore.followedPlayer = value;
      };
      mapRenderer.onVisiblePlaneUpdate = function updateVisiblePlane(value) {
        mapStore.visiblePlane = value;
      };
      resizeCanvas();
      window.cancelAnimationFrame(animationFrameHandle);
      render();
    },
  );
</script>

<template>
  <div id="canvas-map-container">
    <canvas
      id="canvas-map"
      ref="canvas"
      :class="{ dragging: mapStore.dragging, interactive: props.interactive }"
      @pointermove="handlePointerMove"
      @pointerdown="mapStore.renderer?.handlePointerDown()"
      @pointerup="mapStore.renderer?.handlePointerUp()"
      @pointerleave="mapStore.renderer?.handlePointerLeave()"
    />
  </div>
</template>
