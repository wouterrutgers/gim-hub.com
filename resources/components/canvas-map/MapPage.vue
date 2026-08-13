<script setup>
  import { useMapStore } from "../../stores/map";

  const mapStore = useMapStore();

  function selectPlane(event) {
    mapStore.selectPlane(Number.parseInt(event.target.value, 10));
  }
</script>

<template>
  <div id="canvas-map-coordinates">{{ mapStore.coordinatesLabel }}</div>
  <div id="canvas-map-controls">
    <select class="rsborder-tiny rsbackground rsbackground-hover" :value="mapStore.visiblePlane" @change="selectPlane">
      <option v-for="plane in [0, 1, 2, 3]" :key="plane" :value="plane">Plane: {{ plane + 1 }}</option>
    </select>
    <select
      id="canvas-map-follow-dropdown"
      class="rsborder-tiny rsbackground rsbackground-hover"
      @change="mapStore.followPlayer($event.target.value)"
    >
      <option value="">None</option>
      <option v-for="position in mapStore.memberCoordinates" :key="position.label" :value="position.label">
        {{ position.label }}
      </option>
    </select>
    <span id="canvas-map-teleport-buttons">
      <button
        v-for="position in mapStore.memberCoordinates"
        :key="position.label"
        :class="[
          'men-button',
          'men-button-small',
          'canvas-map-teleport-button',
          { 'canvas-map-selected-teleport-button': position.label === mapStore.followedPlayer },
        ]"
        @click="mapStore.followPlayer(position.label)"
      >
        {{ position.label }}
      </button>
    </span>
  </div>
</template>
