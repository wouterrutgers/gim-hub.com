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
        <h3>The group's login</h3>
        <p>Only share these with your group. You can't recover it so keep it safe!</p>
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
        <h3>Setup</h3>
        <p>
          This app requires each group member to install a runelite plugin from the Plugin Hub in order to track player
          information. Find it by searching "<span class="emphasize">GIM hub</span>" in the Runelite client.
        </p>
      </div>

      <div id="setup-config">
        <p>
          Use the provided credentials to fill in the <span class="emphasize">Group Config</span> section in the
          plugin's configuration.
        </p>
        <CachedImage alt="GIM Hub Runelite plugin screenshot" src="/images/plugin-screenshot.png" />
      </div>

      <div id="setup-go-to-group">
        <AppLink href="/group">Go to group</AppLink>
      </div>
    </div>
  </div>
</template>
