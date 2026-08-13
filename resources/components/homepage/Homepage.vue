<script setup>
  import { computed } from "vue";
  import { useApiStore } from "../../stores/api";
  import AppLink from "../app-link/AppLink.vue";
  import CachedImage from "../cached-image/CachedImage.vue";
  import SocialLinks from "../social-links/SocialLinks.vue";
  import "./homepage.css";

  const apiStore = useApiStore();

  const hasLogin = computed(function hasAvailableLogin() {
    return Boolean(apiStore.client || apiStore.hasStoredCredentials);
  });
</script>

<template>
  <div id="homepage">
    <SocialLinks />
    <div class="logo">
      <CachedImage alt="GIM hub" src="/images/logo-quarter.webp" />
    </div>
    <div id="homepage-links">
      <AppLink href="/create-group">Get started</AppLink>
      <AppLink href="/demo">Demo</AppLink>
      <AppLink href="/changelog">Changelog</AppLink>
      <AppLink :href="hasLogin ? '/group' : '/login'">{{ hasLogin ? "Go to group" : "Login" }}</AppLink>
    </div>
  </div>
</template>
