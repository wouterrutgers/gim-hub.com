<script setup>
  import { computed, ref } from "vue";
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

  const subcategory = ref();
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
      category: "Combat achievements",
      ariaLabel: "combat achievements",
      alt: "osrs combat achievements",
      src: "/item-icons/25956.webp",
      width: 32,
      height: 32,
    },
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

    subcategory.value = subcategory.value === button.category ? undefined : button.category;
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
