<script setup>
  import { computed, ref } from "vue";
  import * as z from "zod/v4";
  import { useApiStore } from "../../stores/api";
  import { useGroupStore } from "../../stores/group";
  import { useSettingsStore } from "../../stores/settings";
  import { sidebarPositions, siteThemes } from "../../stores/settings-options";
  import { memberNameSchema } from "../../game/member-name";
  import LoadingScreen from "../loading-screen/LoadingScreen.vue";
  import EditMemberInput from "./EditMemberInput.vue";
  import "./settings.css";

  const labels = {
    light: "Light",
    dark: "Dark",
    left: "Dock panels to the left",
    right: "Dock panels to the right",
  };
  const MEMBER_COUNT_MAX = 5;

  const apiStore = useApiStore();
  const groupStore = useGroupStore();
  const settingsStore = useSettingsStore();

  const addMemberInput = ref();
  const addMemberErrors = ref();
  const pendingAddMember = ref(false);

  const members = computed(function getMembers() {
    return [...groupStore.memberNames].filter(function excludeSharedMember(member) {
      return member !== "@SHARED";
    });
  });

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
</script>

<template>
  <div id="settings-page">
    <div class="group-settings-container rsborder rsbackground">
      <h2>Member settings</h2>
      <div>These <span class="emphasize">do</span> need to match the in-game names.</div>
      <EditMemberInput v-for="member in members" :key="`edit-member-${member}`" :member="member" />

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
      <h2>Appearance settings</h2>
      <fieldset>
        <legend>Player panels</legend>
        <div v-for="position in sidebarPositions" :key="position" class="settings-page-radio-item">
          <input
            :id="`panel-dock-${position}`"
            :value="position"
            type="radio"
            :checked="settingsStore.sidebarPosition === position"
            @change="settingsStore.setSidebarPosition(position)"
          />
          <label :for="`panel-dock-${position}`">{{ labels[position] }}</label>
        </div>

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

        <fieldset class="setting-group">
          <legend class="setting-title">Recent activity</legend>
          <div class="settings-page-radio-item">
            <input
              id="enable-recent-activity-input"
              type="checkbox"
              :checked="settingsStore.enableRecentActivity"
              @change="settingsStore.setEnableRecentActivity($event.target.checked)"
            />
            <label for="enable-recent-activity-input">Show recent activity summaries on player panels</label>
          </div>
        </fieldset>
      </fieldset>

      <fieldset>
        <legend>Style</legend>
        <div v-for="theme in siteThemes" :key="theme" class="settings-page-radio-item">
          <input
            :id="`style-${theme}`"
            :value="theme"
            type="radio"
            :checked="settingsStore.siteTheme === theme"
            @change="settingsStore.setSiteTheme(theme)"
          />
          <label :for="`style-${theme}`">{{ labels[theme] }}</label>
        </div>
      </fieldset>
    </div>
  </div>
</template>
