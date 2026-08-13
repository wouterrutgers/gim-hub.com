<script setup>
  import { computed } from "vue";
  import {
    useGroupStore,
    useMemberInteracting,
    useMemberLastOnlineAt,
    useMemberStats,
    useMemberTimezone,
  } from "../../stores/group";
  import { serializeTooltip } from "../tooltip/tooltip-data";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";
  import XpDropper from "../xp-dropper/XpDropper.vue";
  import StatBar from "./StatBar.vue";
  import "./player-stats.css";

  const INACTIVE_TIMER_MS = 300 * 1000;
  const INTERACTION_TIMER_MS = 30 * 1000;
  const COLORS = {
    player: {
      hitpoints: "#157145",
      hitpointsBackground: "#073823",
      prayer: "#336699",
      prayerBackground: "#112233",
      energy: "#a9a9a9",
      energyBackground: "#383838",
      specialAttack: "#397D3B",
      specialAttackBackground: "#383838",
    },
    interaction: { combat: "#A41623", combatBackground: "#383838", nonCombat: "#333355" },
  };

  const props = defineProps({
    member: { type: String, default: "" },
  });

  const groupStore = useGroupStore();
  const interacting = useMemberInteracting(function getMember() {
    return props.member;
  });
  const stats = useMemberStats(function getMember() {
    return props.member;
  });
  const lastOnlineAt = useMemberLastOnlineAt(function getMember() {
    return props.member;
  });
  const timezone = useMemberTimezone(function getMember() {
    return props.member;
  });

  const playerStats = computed(function getPlayerStats() {
    return (
      stats.value ?? {
        health: { current: 10, max: 10 },
        prayer: { current: 1, max: 1 },
        run: { current: 1, max: 1 },
        specialAttack: { current: 1, max: 1 },
      }
    );
  });
  const online = computed(function isOnline() {
    return Date.now() - (lastOnlineAt.value ?? new Date(0)).getTime() < INACTIVE_TIMER_MS;
  });
  const recentInteraction = computed(function getRecentInteraction() {
    if (!interacting.value || Date.now() - interacting.value.lastUpdated.getTime() >= INTERACTION_TIMER_MS) {
      return undefined;
    }

    return interacting.value;
  });
  const localTime = computed(function getLocalTime() {
    if (!timezone.value) {
      return undefined;
    }

    return new Intl.DateTimeFormat(undefined, { timeZone: timezone.value, timeStyle: "short" }).format(new Date());
  });
  const healthRatio = computed(function getHealthRatio() {
    return playerStats.value.health.current / playerStats.value.health.max;
  });
  const prayerRatio = computed(function getPrayerRatio() {
    return playerStats.value.prayer.current / playerStats.value.prayer.max;
  });
  const runRatio = computed(function getRunRatio() {
    return playerStats.value.run.current / playerStats.value.run.max;
  });
  const specialAttackRatio = computed(function getSpecialAttackRatio() {
    return playerStats.value.specialAttack.current / playerStats.value.specialAttack.max;
  });
  const experienceDrops = computed(function getExperienceDrops() {
    return groupStore.experienceDrops.get(props.member);
  });

  function formatLastOnlineAt(lastOnline) {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(lastOnline);
  }
</script>

<template>
  <div :class="['player-stats', { 'player-stats-inactive': !online }]">
    <XpDropper :xp-drops="experienceDrops" />
    <div class="player-stats-header">
      <div class="player-stats-identity">
        <PlayerIcon :name="props.member" />
        <span class="player-stats-name">{{ props.member }}</span>
      </div>
      <span
        v-if="localTime && timezone"
        class="player-stats-local-time"
        :data-tooltip="serializeTooltip({ type: 'local-time', name: props.member, timezone })"
      >
        {{ localTime }}
      </span>
    </div>

    <div class="player-stats-status">
      <span class="player-stats-status-dot" aria-hidden="true" />
      <span v-if="online">Online</span>
      <span v-else-if="lastOnlineAt?.getTime() > 0">Last online {{ formatLastOnlineAt(lastOnlineAt) }}</span>
      <span v-else>Offline</span>
      <template v-if="online && playerStats.world !== undefined">
        <span class="player-stats-status-separator" aria-hidden="true">·</span>
        <span class="player-stats-world">W{{ playerStats.world }}</span>
      </template>
    </div>

    <div
      class="player-stats-hitpoints"
      :data-tooltip="`Hitpoints: ${playerStats.health.current} / ${playerStats.health.max}`"
    >
      <StatBar
        class-name="player-stats-hitpoints-bar"
        :color="COLORS.player.hitpoints"
        :bg-color="COLORS.player.hitpointsBackground"
        :ratio="healthRatio"
      />
      <div
        v-if="recentInteraction"
        class="player-interacting"
        :data-tooltip="`Interacting with ${recentInteraction.name}`"
      >
        <StatBar
          :color="
            recentInteraction.healthRatio === undefined ? COLORS.interaction.nonCombat : COLORS.interaction.combat
          "
          :bg-color="
            recentInteraction.healthRatio === undefined
              ? COLORS.interaction.nonCombat
              : COLORS.interaction.combatBackground
          "
          :ratio="recentInteraction.healthRatio"
        />
        <div class="player-interacting-name">{{ recentInteraction.name }}</div>
      </div>
      <div class="player-stats-hitpoints-numbers">{{ playerStats.health.current }} / {{ playerStats.health.max }}</div>
    </div>

    <div
      class="player-stats-prayer"
      :data-tooltip="`Prayer: ${playerStats.prayer.current} / ${playerStats.prayer.max}`"
    >
      <StatBar
        class-name="player-stats-prayer-bar"
        :color="COLORS.player.prayer"
        :bg-color="COLORS.player.prayerBackground"
        :ratio="prayerRatio"
      />
      <div class="player-stats-prayer-numbers">{{ playerStats.prayer.current }} / {{ playerStats.prayer.max }}</div>
    </div>

    <div class="player-stats-energy" :data-tooltip="`Run energy: ${Math.floor(runRatio * 100)}%`">
      <StatBar
        class-name="player-stats-energy-bar"
        :color="COLORS.player.energy"
        :bg-color="COLORS.player.energyBackground"
        :ratio="runRatio"
      />
    </div>
    <div class="player-stats-special-attack" :data-tooltip="`Special attack: ${Math.floor(specialAttackRatio * 100)}%`">
      <StatBar
        class-name="player-stats-special-attack-bar"
        :color="COLORS.player.specialAttack"
        :bg-color="COLORS.player.specialAttackBackground"
        :ratio="specialAttackRatio"
      />
    </div>
  </div>
</template>
