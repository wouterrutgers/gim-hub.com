<script setup>
  import { computed } from "vue";
  import { useApiStore } from "../../stores/api";
  import AuthedLayout from "../layout/AuthedLayout.vue";
  import UnauthedLayout from "../layout/UnauthedLayout.vue";
  import ChangelogPage from "./ChangelogPage.vue";

  const apiStore = useApiStore();

  const loggedIn = computed(function isLoggedIn() {
    return Boolean(apiStore.client);
  });
</script>

<template>
  <AuthedLayout v-if="loggedIn" :show-panels="false">
    <ChangelogPage back-href="/group/items" back-label="Go to group" />
  </AuthedLayout>
  <UnauthedLayout v-else>
    <ChangelogPage back-href="/" back-label="Back" />
  </UnauthedLayout>
</template>
