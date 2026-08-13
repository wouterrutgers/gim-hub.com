<script setup>
  import { computed } from "vue";
  import { useGameDataStore } from "../../stores/game-data";
  import { useMemberDiaries, useMemberQuests, useMemberSkills } from "../../stores/group";
  import { computeVirtualLevelFromXP } from "../../game/skill";
  import DiaryRegionWindow from "../achievement-diary/DiaryRegionWindow.vue";
  import Modal from "../modal/Modal.vue";
  import { useModal } from "../modal/use-modal";
  import StatBar from "./StatBar.vue";
  import "./player-diaries.css";

  const props = defineProps({
    member: { type: String, required: true },
  });

  const gameDataStore = useGameDataStore();
  const skills = useMemberSkills(function getMember() {
    return props.member;
  });
  const diaries = useMemberDiaries(function getMember() {
    return props.member;
  });
  const quests = useMemberQuests(function getMember() {
    return props.member;
  });

  const { open: modalOpen, componentProps: modalProps, openModal, closeModal } = useModal();

  const summaries = computed(function getDiarySummaries() {
    const diaryData = gameDataStore.gameData.diaries;

    if (!diaryData) {
      return [];
    }

    return [...diaryData].map(function buildRegionSummary([region, tasksByTier]) {
      const detailedProgress = [];
      const completion = { completed: 0, total: 0 };
      const completionPerTier = [];

      tasksByTier.forEach(function buildTier(tasks, tier) {
        const detailedTasks = [];
        let completedTasks = 0;

        for (const [index, task] of tasks.entries()) {
          const complete = Boolean(diaries.value?.[region]?.[tier]?.[index]);
          completedTasks += complete ? 1 : 0;
          detailedTasks.push({
            complete,
            description: task.task,
            quests: task.requirements.quests.map(function buildQuest(id) {
              return {
                name: gameDataStore.gameData.quests?.get(id)?.name ?? "Summer's End",
                complete: quests.value?.get(id) === "FINISHED",
              };
            }),
            skills: task.requirements.skills.map(function buildSkill({ skill, level }) {
              return { skill, required: level, current: computeVirtualLevelFromXP(skills.value?.[skill] ?? 0) };
            }),
          });
        }

        completionPerTier.push(completedTasks / tasks.length);
        completion.completed += completedTasks;
        completion.total += tasks.length;
        detailedProgress.push([tier, detailedTasks]);
      });

      return { region, completion, completionPerTier, detailedProgress };
    });
  });

  function openDiary(summary) {
    openModal({ region: summary.region, player: props.member, progress: summary.detailedProgress });
  }
</script>

<template>
  <div class="player-diaries">
    <h2 class="player-diaries-title">Achievement diaries</h2>
    <div class="player-diaries-completions">
      <button
        v-for="summary in summaries"
        :key="summary.region"
        class="rsborder-tiny diary-completion"
        @click="openDiary(summary)"
      >
        <div class="diary-completion-top">
          <span>{{ summary.region }}</span>
          <span>{{ summary.completion.completed }}/{{ summary.completion.total }}</span>
        </div>
        <div class="diary-completion-bottom">
          <StatBar
            v-for="(ratio, index) in summary.completionPerTier"
            :key="`${ratio}-${index}`"
            :color="`hsl(${107 * ratio}, 100%, 41%)`"
            bg-color="rgba(0, 0, 0, 0.5)"
            :ratio="ratio"
          />
        </div>
      </button>
    </div>

    <Modal :open="modalOpen" :component="DiaryRegionWindow" :component-props="modalProps" @close="closeModal" />
  </div>
</template>
