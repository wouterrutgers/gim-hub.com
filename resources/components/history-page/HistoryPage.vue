<script setup>
  import { computed } from "vue";
  import { useGroupStore } from "../../stores/group";
  import { useSnapshotStore } from "../../stores/snapshots";
  import { activityHasChanges, computeActivity } from "../../game/player-activity";
  import Modal from "../modal/Modal.vue";
  import { useModal } from "../modal/use-modal";
  import PlayerActivityWindow from "../player-activity/PlayerActivityWindow.vue";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";
  import SkillGraph from "../skill-graph/SkillGraph.vue";
  import "./history-page.css";

  const groupStore = useGroupStore();
  const snapshotStore = useSnapshotStore();

  const {
    open: activityModalOpen,
    componentProps: activityModalProps,
    openModal: openActivityModal,
    closeModal: closeActivityModal,
  } = useModal();

  const members = computed(function getMembers() {
    return [...groupStore.memberNames]
      .filter(function excludeSharedMember(member) {
        return member !== "@SHARED";
      })
      .sort(function sortMembers(firstMember, secondMember) {
        return firstMember.localeCompare(secondMember);
      });
  });

  function memberHasNewActivity(member) {
    const baseline = snapshotStore.getBaselineSnapshot(member);
    const currentState = groupStore.memberStates.get(member);
    const activity = baseline && currentState ? computeActivity(baseline.snapshot, currentState) : undefined;

    return activity ? activityHasChanges(activity) : false;
  }

  function openMemberActivity(member) {
    async function clearMemberActivity() {
      try {
        await snapshotStore.clearBaselineSnapshot(member);
      } catch (reason) {
        console.error("Failed to clear recent activity", reason);
        throw reason;
      }
    }

    openActivityModal({ player: member, onClearSnapshot: clearMemberActivity });
  }
</script>

<template>
  <Modal
    :open="activityModalOpen"
    :component="PlayerActivityWindow"
    :component-props="activityModalProps"
    @close="closeActivityModal"
  />

  <div id="history-page">
    <section class="history-page-activity rsborder rsbackground" aria-labelledby="recent-activity-heading">
      <div class="history-page-activity-header">
        <div>
          <h1 id="recent-activity-heading">Recent activity</h1>
          <p>Choose a member to review their progress since your last visit or over the past week.</p>
        </div>
      </div>
      <div class="history-page-member-grid">
        <button
          v-for="member in members"
          :key="member"
          class="history-page-member rsborder-tiny rsbackground rsbackground-hover"
          type="button"
          :aria-label="`View ${member}'s recent activity`"
          @click="openMemberActivity(member)"
        >
          <span class="history-page-member-icon" aria-hidden="true">
            <PlayerIcon :name="member" />
          </span>
          <span class="history-page-member-details">
            <strong>{{ member }}</strong>
            <span :class="{ 'history-page-member-new': memberHasNewActivity(member) }">
              {{ memberHasNewActivity(member) ? "New activity" : "View recent activity" }}
            </span>
          </span>
          <span class="history-page-member-action" aria-hidden="true">Open <span>›</span></span>
        </button>
      </div>
    </section>

    <section class="history-page-skill-history" aria-labelledby="skill-history-heading">
      <h2 id="skill-history-heading">Skill history</h2>
      <SkillGraph />
    </section>
  </div>
</template>
