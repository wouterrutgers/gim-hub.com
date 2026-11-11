<script setup>
  import { computed, ref } from "vue";
  import * as z from "zod/v4";
  import { useApiStore } from "../../stores/api";
  import { useGroupStore } from "../../stores/group";
  import { usePlayerPreferencesStore } from "../../stores/player-preferences";
  import { useSettingsStore } from "../../stores/settings";
  import { siteThemes } from "../../stores/settings-options";
  import { memberNameSchema } from "../../game/member-name";
  import LoadingScreen from "../loading-screen/LoadingScreen.vue";
  import PlayerIcon from "../player-icon/PlayerIcon.vue";
  import EditMemberInput from "./EditMemberInput.vue";
  import "./settings.css";

  const labels = {
    light: "Light",
    dark: "Dark",
    browntown: "Browntown",
    "classic-light": "Classic light",
    "classic-dark": "Classic dark",
  };
  const MEMBER_COUNT_MAX = 5;

  const apiStore = useApiStore();
  const groupStore = useGroupStore();
  const playerPreferencesStore = usePlayerPreferencesStore();
  const settingsStore = useSettingsStore();

  const addMemberInput = ref();
  const addMemberErrors = ref();
  const pendingAddMember = ref(false);
  const pendingReorder = ref(false);
  const reorderError = ref();

  const usesClassicTheme = computed(function classicThemeIsSelected() {
    return ["classic-light", "classic-dark"].includes(settingsStore.siteTheme);
  });
  const classicSettingsDiffer = computed(function classicSettingsAreDifferent() {
    return (
      !settingsStore.showItemOwners || !settingsStore.collapseNavigation || settingsStore.pageBackgroundOpacity !== 90
    );
  });

  const members = computed(function getMembers() {
    return [...groupStore.memberNames].filter(function excludeSharedMember(member) {
      return member !== "@SHARED";
    });
  });

  function applyClassicSettings() {
    settingsStore.setShowItemOwners(true);
    settingsStore.setCollapseNavigation(true);
    settingsStore.setPageBackgroundOpacity(90);
  }

  async function addMember() {
    if (pendingAddMember.value || !apiStore.client || !addMemberInput.value) {
      return;
    }

    const name = memberNameSchema.safeParse(addMemberInput.value.value.trim());

    if (!name.success) {
      addMemberErrors.value = z.flattenError(name.error).formErrors;

      return;
    }

    pendingAddMember.value = true;

    try {
      const [response] = await Promise.all([
        apiStore.client.addGroupMember(name.data),
        new Promise(function waitForLoadingState(resolve) {
          window.setTimeout(resolve, 1000);
        }),
      ]);

      addMemberErrors.value = response.status === "error" ? [response.text] : undefined;
    } catch (reason) {
      console.error("Add Member Failed:", reason);
      addMemberErrors.value = ["Unknown error."];
    } finally {
      pendingAddMember.value = false;
    }
  }

  async function moveMember(index, direction) {
    if (pendingReorder.value || !apiStore.client) {
      return;
    }

    const memberNames = [...members.value];
    [memberNames[index], memberNames[index + direction]] = [memberNames[index + direction], memberNames[index]];
    pendingReorder.value = true;

    try {
      const response = await apiStore.client.reorderGroupMembers(memberNames);
      reorderError.value = response.status === "error" ? response.text : undefined;

      if (response.status === "ok") {
        groupStore.updateMemberOrder(memberNames);
      }
    } catch (reason) {
      console.error("Reorder Members Failed:", reason);
      reorderError.value = "Failed to reorder members.";
    } finally {
      pendingReorder.value = false;
    }
  }
</script>

<template>
  <div id="settings-page">
    <div class="settings-player-container group-settings-container rsborder rsbackground">
      <div class="settings-player-details">
        <div class="settings-player-heading">
          <h2>Your player</h2>
          <span v-if="playerPreferencesStore.selectedMemberName" class="settings-player-name">
            <PlayerIcon :name="playerPreferencesStore.selectedMemberName" />
            {{ playerPreferencesStore.selectedMemberName }}
          </span>
        </div>
        <p v-if="apiStore.isDemo" class="settings-description">Preferences apply to this demo visit only.</p>
        <p v-else class="settings-description">
          {{
            playerPreferencesStore.selectedMemberName
              ? "Your preferences and pinned items sync across devices for this player."
              : "Choose your player to sync your preferences and pinned items across devices."
          }}
        </p>
      </div>
      <button
        v-if="!apiStore.isDemo"
        type="button"
        class="settings-change-player men-button button-primary"
        :disabled="playerPreferencesStore.members.length === 0"
        aria-haspopup="dialog"
        aria-controls="player-chooser-window"
        :aria-expanded="playerPreferencesStore.chooserOpen"
        @click="playerPreferencesStore.openChooser()"
      >
        {{ playerPreferencesStore.selectedMemberName ? "Change player" : "Choose your player" }}
      </button>
    </div>

    <div class="group-settings-container rsborder rsbackground">
      <h2>Your members</h2>
      <p class="settings-description">Display names must match your members' exact names in OSRS.</p>
      <div v-for="(member, index) in members" :key="`edit-member-${member}`" class="group-settings-member-row">
        <EditMemberInput :member="member" />
        <div class="group-settings-member-order" role="group" :aria-label="`Order ${member}`">
          <button
            class="men-button small"
            :disabled="index === 0 || pendingReorder"
            :aria-label="`Move ${member} up`"
            @click="moveMember(index, -1)"
          >
            <span class="chevron chevron-up" aria-hidden="true" />
          </button>
          <button
            class="men-button small"
            :disabled="index === members.length - 1 || pendingReorder"
            :aria-label="`Move ${member} down`"
            @click="moveMember(index, 1)"
          >
            <span class="chevron" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div v-if="reorderError" role="alert" class="validation-error">{{ reorderError }}</div>

      <div v-if="members.length < MEMBER_COUNT_MAX" class="group-settings-member-section rsborder-tiny">
        <div class="group-settings-member-name">
          <label for="add-member-input">Name for new member</label>
          <div class="group-settings-member-name-input">
            <input
              id="add-member-input"
              ref="addMemberInput"
              aria-describedby="add-member-errors"
              :disabled="pendingAddMember"
              :class="addMemberErrors?.length ? 'invalid' : 'valid'"
              maxlength="12"
              @blur="$event.target.value = $event.target.value.trim()"
            />
            <button :disabled="pendingAddMember" class="edit-member__add men-button small" @click="addMember">
              Add member
            </button>
          </div>
        </div>
        <div v-if="addMemberErrors?.length" id="add-member-errors" class="validation-error">
          <template v-for="(error, index) in addMemberErrors" :key="error"><br v-if="index > 0" />{{ error }}</template>
        </div>
        <div v-if="pendingAddMember" class="group-settings-pending-overlay"><LoadingScreen /></div>
      </div>
    </div>

    <div class="group-settings-container rsborder rsbackground">
      <h2>Your preferences</h2>
      <fieldset>
        <legend>Player panels</legend>
        <fieldset class="setting-group">
          <legend class="setting-title">Skills</legend>
          <div class="settings-page-radio-item">
            <input
              id="enable-virtual-levels-input"
              type="checkbox"
              :checked="settingsStore.enableVirtualLevels"
              @change="settingsStore.setEnableVirtualLevels($event.target.checked)"
            />
            <label for="enable-virtual-levels-input">Show virtual levels</label>
          </div>
          <div class="settings-page-radio-item">
            <input
              id="enable-skill-progress-bars-input"
              type="checkbox"
              :checked="settingsStore.enableSkillProgressBars"
              @change="settingsStore.setEnableSkillProgressBars($event.target.checked)"
            />
            <label for="enable-skill-progress-bars-input">Show skill progress bars</label>
          </div>
        </fieldset>

        <fieldset class="setting-group">
          <legend class="setting-title">Items</legend>
          <div class="settings-page-radio-item">
            <input
              id="enable-gearscape-export-input"
              type="checkbox"
              :checked="settingsStore.enableGearscapeExport"
              @change="settingsStore.setEnableGearscapeExport($event.target.checked)"
            />
            <label for="enable-gearscape-export-input">Show Gearscape export button</label>
          </div>
        </fieldset>
      </fieldset>

      <fieldset>
        <legend>History</legend>
        <div class="settings-page-radio-item">
          <input
            id="expand-player-history-input"
            type="checkbox"
            :checked="settingsStore.expandPlayerHistory"
            @change="settingsStore.setExpandPlayerHistory($event.target.checked)"
          />
          <label for="expand-player-history-input">Expand all player rows by default</label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Style</legend>
        <div v-for="theme in siteThemes" :key="theme" class="settings-page-radio-item">
          <input
            :id="`style-${theme}`"
            :value="theme"
            type="radio"
            name="site-theme"
            :checked="settingsStore.siteTheme === theme"
            @change="settingsStore.setSiteTheme(theme)"
          />
          <label :for="`style-${theme}`">{{ labels[theme] }}</label>
        </div>
        <div aria-live="polite">
          <div v-if="usesClassicTheme" class="settings-classic-offer rsborder-tiny">
            <h3>Make it feel more like the old theme?</h3>
            <p id="classic-settings-description" class="settings-description">
              Use detailed items, collapse the desktop navigation, and set background opacity to 90%.
            </p>
            <div class="settings-classic-offer-actions">
              <button
                type="button"
                class="men-button"
                aria-describedby="classic-settings-description"
                :disabled="!classicSettingsDiffer"
                @click="applyClassicSettings"
              >
                {{ classicSettingsDiffer ? "Apply classic settings" : "Classic settings applied" }}
              </button>
            </div>
          </div>
        </div>
        <div class="settings-page-range-item">
          <label for="page-background-opacity-input">Background opacity</label>
          <div class="settings-page-range-control">
            <input
              id="page-background-opacity-input"
              type="range"
              min="0"
              max="100"
              :value="settingsStore.pageBackgroundOpacity"
              @input="settingsStore.previewPageBackgroundOpacity($event.target.valueAsNumber)"
              @change="settingsStore.setPageBackgroundOpacity($event.target.valueAsNumber)"
            />
            <output for="page-background-opacity-input">{{ settingsStore.pageBackgroundOpacity }}%</output>
          </div>
        </div>
      </fieldset>
    </div>
  </div>
</template>
