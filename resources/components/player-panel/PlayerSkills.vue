<script setup>
  import { computed } from "vue";
  import { useMemberSkills } from "../../stores/group";
  import { useSettingsStore } from "../../stores/settings";
  import { skillIcons, decomposeExperience } from "../../game/skill";
  import { serializeTooltip } from "../tooltip/tooltip-data";
  import CachedImage from "../cached-image/CachedImage.vue";
  import "./player-skills.css";

  const SkillsInOSRSDisplayOrder = [
    "Attack",
    "Hitpoints",
    "Mining",
    "Strength",
    "Agility",
    "Smithing",
    "Defence",
    "Herblore",
    "Fishing",
    "Ranged",
    "Thieving",
    "Cooking",
    "Prayer",
    "Crafting",
    "Firemaking",
    "Magic",
    "Fletching",
    "Woodcutting",
    "Runecraft",
    "Slayer",
    "Farming",
    "Construction",
    "Hunter",
    "Sailing",
  ];

  const props = defineProps({
    member: { type: String, required: true },
  });

  const settingsStore = useSettingsStore();
  const skills = useMemberSkills(function getMember() {
    return props.member;
  });

  const skillRows = computed(function getSkillRows() {
    return SkillsInOSRSDisplayOrder.map(function buildSkillRow(skill) {
      const experience = skills.value?.[skill] ?? 0;
      const decomposition = decomposeExperience(experience);
      const displayedLevel = settingsStore.enableVirtualLevels ? decomposition.levelVirtual : decomposition.levelReal;
      const hasNextLevel = decomposition.xpMilestoneOfNext > decomposition.xpMilestoneOfCurrent;
      const levelProgress = hasNextLevel
        ? (experience - decomposition.xpMilestoneOfCurrent) /
          (decomposition.xpMilestoneOfNext - decomposition.xpMilestoneOfCurrent)
        : 1;

      return {
        skill,
        experience,
        displayedLevel,
        levelReal: decomposition.levelReal,
        levelVirtual: decomposition.levelVirtual,
        levelProgress,
        tooltip: serializeTooltip({
          type: "skill-individual",
          experience,
          level: displayedLevel,
          untilMax: Math.max(0, decomposition.xpDeltaFromMax - experience),
          untilMaxRatio: Math.min(experience / decomposition.xpDeltaFromMax, 1),
          untilNext: hasNextLevel ? decomposition.xpMilestoneOfNext - experience : 0,
          untilNextRatio: Math.min(levelProgress, 1),
        }),
      };
    });
  });
  const levelTotal = computed(function getLevelTotal() {
    return skillRows.value.reduce(function addLevel(total, skill) {
      return total + skill.levelReal;
    }, 0);
  });
  const experienceTotal = computed(function getExperienceTotal() {
    return skillRows.value.reduce(function addExperience(total, skill) {
      return total + skill.experience;
    }, 0);
  });
</script>

<template>
  <div class="player-skills">
    <a
      v-for="skill in skillRows"
      :key="skill.skill"
      :href="`https://oldschool.runescape.wiki/w/${skill.skill}`"
      target="_blank"
      rel="noopener noreferrer"
      class="skill-box"
      :data-tooltip="skill.tooltip"
    >
      <div class="skill-box-left">
        <CachedImage :alt="`osrs ${skill.skill} icon`" class="skill-box__icon" :src="skillIcons[skill.skill] ?? ''" />
      </div>
      <div class="skill-box-right">
        <div class="skill-box-current-level">{{ skill.levelReal }}</div>
        <div
          :class="[
            'skill-box-baseline-level',
            { 'shrink-level': settingsStore.enableVirtualLevels && skill.levelVirtual !== skill.levelReal },
          ]"
        >
          {{ skill.displayedLevel }}
        </div>
      </div>
      <div v-if="settingsStore.enableSkillProgressBars" class="skill-box-progress">
        <div
          class="skill-box-progress-bar"
          :style="{
            transform: `scaleX(${skill.levelProgress})`,
            background: `hsl(${skill.levelProgress * 100}, 100%, 50%)`,
          }"
        />
      </div>
    </a>

    <div
      class="total-level-box"
      style="grid-column: 1 / span 3"
      :data-tooltip="serializeTooltip({ type: 'skill-total', experience: experienceTotal })"
    >
      <div class="total-level-box-content">
        <span>Total level: {{ levelTotal }}</span>
      </div>
    </div>
  </div>
</template>
