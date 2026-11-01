<script setup>
  import { computed, ref } from "vue";
  import { useApiStore } from "../../stores/api";
  import AppLink from "../app-link/AppLink.vue";
  import CachedImage from "../cached-image/CachedImage.vue";
  import "./setup-instructions.css";

  const apiStore = useApiStore();

  const tokenVisible = ref(false);

  const credentials = computed(function getCredentials() {
    return apiStore.credentials;
  });
</script>

<template>
  <div id="setup-instructions-container">
    <div id="setup-instructions" class="rsbackground rsborder">
      <div class="setup-block">
        <h2>Your group credentials</h2>
        <p>Share these only with your group. Your token cannot be recovered, so save it somewhere safe.</p>
        <div class="setup-block">
          <h4>Group name</h4>
          <div class="setup-credential rsborder-tiny rsbackground">{{ credentials?.name ?? "Group name" }}</div>
        </div>

        <div class="setup-block">
          <h4>Group token</h4>
          <div class="setup-credential rsborder-tiny rsbackground">
            <template v-if="tokenVisible">
              {{ credentials?.token ?? "00000000-0000-0000-0000-000000000000" }}
            </template>
            <template v-else>
              <button id="setup-credential-hide" @click="tokenVisible = true">Click to show token</button>
              00000000-0000-0000-0000-000000000000
            </template>
          </div>
        </div>
      </div>

      <div class="setup-block">
        <h2>Install the plugin</h2>
        <p>
          Each member needs the GIM hub plugin to share their progress. Open the Plugin Hub in RuneLite and search for
          <span class="emphasize">GIM hub</span>.
        </p>
      </div>

      <div id="setup-config">
        <p>
          Enter your group name and token in the plugin's group configuration. Log in to OSRS and your group will appear
          here.
        </p>
        <CachedImage alt="GIM Hub Runelite plugin screenshot" src="/images/plugin-screenshot.png" />
      </div>

      <div id="setup-go-to-group">
        <AppLink href="/group" class="button-primary">Go to your group</AppLink>
      </div>
    </div>
  </div>
</template>
