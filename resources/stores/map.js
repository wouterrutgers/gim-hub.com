import { computed, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import { useGroupStore } from "./group";

export const useMapStore = defineStore("map", function createMapStore() {
  const groupStore = useGroupStore();
  const renderer = shallowRef();
  const dragging = ref(false);
  const coordinates = ref();
  const followedPlayer = ref();
  const visiblePlane = ref(0);

  const memberCoordinates = computed(function getMemberCoordinates() {
    return [...groupStore.memberStates]
      .filter(function hasCoordinates([, state]) {
        return state.coordinates;
      })
      .map(function labelCoordinates([name, state]) {
        return {
          label: name,
          coords: state.coordinates.coords,
          plane: state.coordinates.plane,
          isOnBoat: state.coordinates.isOnBoat,
        };
      });
  });
  const coordinatesLabel = computed(function getCoordinatesLabel() {
    if (!coordinates.value) {
      return undefined;
    }

    return `X: ${Math.floor(coordinates.value.x)}, Y: ${Math.floor(coordinates.value.y)}`;
  });

  function setRenderer(mapRenderer) {
    renderer.value = mapRenderer;
  }

  function selectPlane(plane) {
    if (renderer.value && visiblePlane.value !== plane) {
      renderer.value.setPlane(plane);
    }
  }

  function followPlayer(player) {
    if (!renderer.value) {
      return;
    }

    renderer.value.startFollowingPlayer({ player });
    renderer.value.forceRenderNextFrame = true;
  }

  return {
    renderer,
    dragging,
    coordinates,
    followedPlayer,
    visiblePlane,
    memberCoordinates,
    coordinatesLabel,
    setRenderer,
    selectPlane,
    followPlayer,
  };
});
