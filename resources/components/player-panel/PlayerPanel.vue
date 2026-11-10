<script setup>
  import { computed } from "vue";
  import { useRememberedState } from "../../composables/remembered-state";
  import CachedImage from "../cached-image/CachedImage.vue";
  import CollectionLogWindow from "../collection-log/CollectionLogWindow.vue";
  import CombatAchievementsWindow from "../combat-achievements/CombatAchievementsWindow.vue";
  import Modal from "../modal/Modal.vue";
  import { useModal } from "../modal/use-modal";
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

  const [subcategory, setSubcategory] = useRememberedState({
    key: `player-panel-${props.member}`,
    defaultValue: undefined,
  });
  const {
    open: collectionLogModalOpen,
    componentProps: collectionLogModalProps,
    openModal: openCollectionLogModal,
    closeModal: closeCollectionLogModal,
  } = useModal();
  const {
    open: combatAchievementsModalOpen,
    componentProps: combatAchievementsModalProps,
    openModal: openCombatAchievementsModal,
    closeModal: closeCombatAchievementsModal,
  } = useModal();

  const buttons = [
    {
      category: "Inventory",
      ariaLabel: "inventory",
      alt: "osrs inventory",
      src: "/ui/777-0.png",
    },
    {
      category: "Equipment",
      ariaLabel: "equipment",
      alt: "osrs t-posing knight",
      src: "/ui/778-0.png",
    },
    { category: "Skills", ariaLabel: "skills", alt: "osrs skills", src: "/ui/3579-0.png" },
    { category: "Quests", ariaLabel: "quests", alt: "osrs quest", src: "/ui/776-0.png" },
    { category: "Diaries", ariaLabel: "diaries", alt: "osrs diary", src: "/ui/1298-0.png" },
    {
      category: "Combat achievements",
      opensDialog: true,
      ariaLabel: "combat achievements",
      alt: "osrs combat achievements",
      src: "/item-icons/25956.webp",
      className: "player-panel-item-icon",
    },
    {
      category: "Collection log",
      opensDialog: true,
      ariaLabel: "collection-log",
      alt: "osrs collection log",
      src: "/item-icons/22711.webp",
      className: "player-panel-item-icon",
    },
  ];

  const selectedComponent = computed(function getSelectedComponent() {
    return {
      Inventory: PlayerInventory,
      Equipment: PlayerEquipment,
      Skills: PlayerSkills,
      Quests: PlayerQuests,
      Diaries: PlayerDiaries,
    }[subcategory.value];
  });

  function activateButton(button) {
    if (!props.member) {
      return;
    }

    if (button.category === "Collection log") {
      openCollectionLogModal({ player: props.member });

      return;
    }

    if (button.category === "Combat achievements") {
      openCombatAchievementsModal({ player: props.member });

      return;
    }

    setSubcategory(subcategory.value === button.category ? undefined : button.category);
  }
</script>

<template>
  <Modal
    :open="combatAchievementsModalOpen"
    :component="CombatAchievementsWindow"
    :component-props="combatAchievementsModalProps"
    @close="closeCombatAchievementsModal"
  />
  <Modal
    :open="collectionLogModalOpen"
    :component="CollectionLogWindow"
    :component-props="collectionLogModalProps"
    @close="closeCollectionLogModal"
  />

  <div :class="['player-panel', 'rsborder', 'rsbackground', { expanded: selectedComponent }]">
    <PlayerStats :member="props.member ?? ''" />

    <div class="player-panel-minibar">
      <button
        v-for="button in buttons"
        :key="button.category"
        :class="[{ 'player-panel-tab-active': button.category === subcategory }, button.className]"
        :aria-label="button.ariaLabel"
        :aria-pressed="button.opensDialog ? undefined : button.category === subcategory"
        :aria-haspopup="button.opensDialog ? 'dialog' : undefined"
        :data-tooltip="button.category"
        type="button"
        @click="activateButton(button)"
      >
        <CachedImage :alt="button.alt" :src="button.src" />
      </button>
    </div>
    <div class="player-panel-content">
      <component :is="selectedComponent" v-if="props.member && selectedComponent" :member="props.member" />
    </div>
  </div>
</template>
