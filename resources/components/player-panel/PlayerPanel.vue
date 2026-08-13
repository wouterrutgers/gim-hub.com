<script setup>
  import { computed, ref, watch } from "vue";
  import { useApiStore } from "../../stores/api";
  import { useGroupStore } from "../../stores/group";
  import { useSettingsStore } from "../../stores/settings";
  import { useSnapshotStore } from "../../stores/snapshots";
  import { activityHasChanges, computeActivity } from "../../game/player-activity";
  import CachedImage from "../cached-image/CachedImage.vue";
  import { BOSS_KC_KEYS } from "../collection-log/boss-kc";
  import CollectionLogWindow from "../collection-log/CollectionLogWindow.vue";
  import Modal from "../modal/Modal.vue";
  import { useModal } from "../modal/use-modal";
  import PlayerActivityWindow from "../player-activity/PlayerActivityWindow.vue";
  import PlayerDiaries from "./PlayerDiaries.vue";
  import PlayerEquipment from "./PlayerEquipment.vue";
  import PlayerInventory from "./PlayerInventory.vue";
  import PlayerQuests from "./PlayerQuests.vue";
  import PlayerSkills from "./PlayerSkills.vue";
  import PlayerStats from "./PlayerStats.vue";
  import "./player-panel.css";

  const props = defineProps({
    member: { type: String, default: undefined },
  });

  const apiStore = useApiStore();
  const groupStore = useGroupStore();
  const settingsStore = useSettingsStore();
  const snapshotStore = useSnapshotStore();

  const subcategory = ref();
  const readActivity = ref();
  const clearingActivity = ref(false);
  const clearActivityError = ref();
  const hiscores = ref();
  const {
    open: collectionLogModalOpen,
    componentProps: collectionLogModalProps,
    openModal: openCollectionLogModal,
    closeModal: closeCollectionLogModal,
  } = useModal();
  const {
    open: activityModalOpen,
    componentProps: activityModalProps,
    openModal: openActivityModal,
    closeModal: closeActivityModal,
  } = useModal();

  const buttons = [
    {
      category: "Inventory",
      ariaLabel: "inventory",
      alt: "osrs inventory",
      src: "/ui/777-0.png",
      width: 26,
      height: 28,
    },
    {
      category: "Equipment",
      ariaLabel: "equipment",
      alt: "osrs t-posing knight",
      src: "/ui/778-0.png",
      width: 27,
      height: 32,
    },
    { category: "Skills", ariaLabel: "skills", alt: "osrs skills", src: "/ui/3579-0.png", width: 23, height: 22 },
    { category: "Quests", ariaLabel: "quests", alt: "osrs quest", src: "/ui/776-0.png", width: 22, height: 22 },
    { category: "Diaries", ariaLabel: "diaries", alt: "osrs diary", src: "/ui/1298-0.png", width: 22, height: 22 },
    {
      category: "Collection log",
      ariaLabel: "collection-log",
      alt: "osrs collection log",
      src: "/item-icons/22711.webp",
      width: 32,
      height: 32,
      className: "player-panel-collection-log",
    },
  ];

  const baseline = computed(function getBaseline() {
    return props.member ? snapshotStore.getBaselineSnapshot(props.member) : undefined;
  });
  const activity = computed(function getActivity() {
    const currentState = props.member ? groupStore.memberStates.get(props.member) : undefined;

    return baseline.value && currentState ? computeActivity(baseline.value.snapshot, currentState) : undefined;
  });
  const hasBossKillCountChanges = computed(function hasBossKillCountChanges() {
    const bossKillCounts = baseline.value?.snapshot.bossKc;

    return hiscores.value !== undefined && bossKillCounts !== undefined
      ? Object.entries(bossKillCounts).some(function bossKillCountIncreased([key, before]) {
          return BOSS_KC_KEYS.has(key) && (hiscores.value.get(key) ?? 0) > before;
        })
      : false;
  });
  const showActivityRow = computed(function shouldShowActivityRow() {
    const hasActivity = activity.value ? activityHasChanges(activity.value) : false;

    return (
      settingsStore.enableRecentActivity &&
      (readActivity.value !== undefined ||
        ((hasActivity || hasBossKillCountChanges.value) && activity.value !== undefined))
    );
  });
  const selectedComponent = computed(function getSelectedComponent() {
    return {
      Inventory: PlayerInventory,
      Equipment: PlayerEquipment,
      Skills: PlayerSkills,
      Quests: PlayerQuests,
      Diaries: PlayerDiaries,
    }[subcategory.value];
  });

  async function clearActivity() {
    if (!props.member || clearingActivity.value) {
      return;
    }

    clearingActivity.value = true;
    clearActivityError.value = undefined;

    try {
      await snapshotStore.clearBaselineSnapshot(props.member);
      readActivity.value = undefined;
    } catch (reason) {
      console.error("Failed to clear recent activity", reason);
      clearActivityError.value = "Could not clear activity. Please try again.";
      throw reason;
    } finally {
      clearingActivity.value = false;
    }
  }

  function activateButton(button) {
    if (!props.member) {
      return;
    }

    if (button.category === "Collection log") {
      openCollectionLogModal({ player: props.member });

      return;
    }

    subcategory.value = subcategory.value === button.category ? undefined : button.category;
  }

  function viewActivity() {
    const frozenActivity = readActivity.value ?? activity.value;

    if (!props.member || !frozenActivity) {
      return;
    }

    readActivity.value ??= frozenActivity;
    openActivityModal({
      player: props.member,
      currentHiscores: hiscores.value,
      onClearSnapshot: clearActivity,
    });
  }

  watch(
    function getBaselineBossKillCounts() {
      return baseline.value?.snapshot.bossKc;
    },
    function loadHiscores(bossKillCounts, _previousBossKillCounts, onCleanup) {
      if (!bossKillCounts || !apiStore.client || !props.member) {
        return;
      }

      let cancelled = false;
      onCleanup(function cancelHiscoresRequest() {
        cancelled = true;
      });
      apiStore.client.fetchMemberHiscores(props.member).then(
        function storeHiscores(result) {
          if (!cancelled) hiscores.value = result;
        },
        function storeEmptyHiscores() {
          if (!cancelled) hiscores.value = new Map();
        },
      );
    },
    { immediate: true },
  );
</script>

<template>
  <Modal
    :open="collectionLogModalOpen"
    :component="CollectionLogWindow"
    :component-props="collectionLogModalProps"
    @close="closeCollectionLogModal"
  />
  <Modal
    :open="activityModalOpen"
    :component="PlayerActivityWindow"
    :component-props="activityModalProps"
    @close="closeActivityModal"
  />

  <div :class="['player-panel', 'rsborder', 'rsbackground', { expanded: selectedComponent }]">
    <PlayerStats :member="props.member ?? ''" />

    <div v-if="showActivityRow" class="player-panel-activity">
      <div class="player-panel-activity-row">
        <button
          class="player-panel-activity-btn"
          type="button"
          aria-label="View recent activity"
          :disabled="clearingActivity"
          @click="viewActivity"
        >
          {{ readActivity ? "View recent activity" : "New recent activity!" }}
        </button>
        <button
          class="player-panel-activity-clear"
          type="button"
          :aria-label="clearingActivity ? 'Clearing activity' : 'Clear activity'"
          :disabled="clearingActivity"
          @click="clearActivity().catch(function ignoreClearError() {})"
        >
          ✕
        </button>
      </div>
      <p v-if="clearActivityError" class="player-panel-activity-error validation-error" role="alert">
        {{ clearActivityError }}
      </p>
    </div>

    <div class="player-panel-minibar">
      <button
        v-for="button in buttons"
        :key="button.category"
        :class="[{ 'player-panel-tab-active': button.category === subcategory }, button.className]"
        :aria-label="button.ariaLabel"
        type="button"
        @click="activateButton(button)"
      >
        <CachedImage :alt="button.alt" :src="button.src" :width="button.width" :height="button.height" />
      </button>
    </div>
    <div class="player-panel-content">
      <component :is="selectedComponent" v-if="props.member && selectedComponent" :member="props.member" />
    </div>
  </div>
</template>
