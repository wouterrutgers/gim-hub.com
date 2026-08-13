<script setup>
  import { computed } from "vue";
  import { skillIcons } from "../../game/skill";
  import CachedImage from "../cached-image/CachedImage.vue";
  import "./achievement-log.css";

  const props = defineProps({
    player: { type: String, required: true },
    region: { type: String, required: true },
    progress: { type: Array, required: true },
  });
  const emit = defineEmits(["close"]);

  const regionHref = computed(function getRegionHref() {
    return `https://oldschool.runescape.wiki/w/${props.region.replace(/ /g, "_")}_Diary`;
  });
  const tiers = computed(function getTiers() {
    return props.progress.map(function buildTier([tier, tasks]) {
      return {
        tier,
        href: `${regionHref.value}#${tier}`,
        complete: tasks.every(function taskIsComplete(task) {
          return task.complete;
        }),
        tasks: tasks.map(function buildTask(task) {
          return {
            ...task,
            requirements: [
              ...task.skills.map(function buildSkillRequirement(skill) {
                return {
                  key: `${skill.skill} ${skill.required} ${skill.current}`,
                  label: `${skill.current} / ${skill.required}`,
                  icon: skillIcons[skill.skill],
                  complete: skill.current >= skill.required,
                };
              }),
              ...task.quests.map(function buildQuestRequirement(quest) {
                return { key: `${quest.name} ${quest.complete}`, label: quest.name, complete: quest.complete };
              }),
            ],
          };
        }),
      };
    });
  });

  function close() {
    emit("close");
  }
</script>

<template>
  <div class="diary-dialog-container metal-border rsbackground">
    <div class="diary-dialog-header">
      <h1>
        {{ `${props.player}'s ` }}
        <a class="diary-dialog-title" :href="regionHref" target="_blank" rel="noopener noreferrer">
          {{ `${props.region} achievement diary` }}
        </a>
      </h1>
      <button class="diary-dialog-close dialog-close" data-tooltip="Close dialog" @click="close">
        <CachedImage src="/ui/1731-0.png" alt="Close dialog" />
      </button>
    </div>
    <div class="diary-dialog-title-border" />
    <div class="diary-dialog-scroll-container">
      <div
        v-for="tier in tiers"
        :key="tier.tier"
        :class="['diary-dialog-section', { 'diary-dialog-tier-complete': tier.complete }]"
      >
        <h2 class="diary-dialog-section-title">
          <a :href="tier.href" target="_blank" rel="noopener noreferrer">{{ tier.tier }}</a>
        </h2>
        <div
          v-for="task in tier.tasks"
          :key="`${task.complete} ${task.description} ${task.quests.length} ${task.skills.length}`"
          :class="['diary-dialog-task', { 'diary-dialog-task-complete': task.complete }]"
        >
          {{ task.description }}
          <template v-if="task.requirements.length > 0">
            (
            <template v-for="(requirement, index) in task.requirements" :key="requirement.key">
              <span :class="['diary-dialog-skill-icon', { 'diary-dialog-skill-complete': requirement.complete }]">
                {{ requirement.label }}
                <CachedImage v-if="requirement.icon" :alt="requirement.label" :src="requirement.icon" /> </span
              >{{ index < task.requirements.length - 1 ? "," : "" }}
            </template>
            )
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
