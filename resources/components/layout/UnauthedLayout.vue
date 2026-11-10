<script setup>
  import { computed } from "vue";
  import { useApiStore } from "../../stores/api";
  import CachedImage from "../cached-image/CachedImage.vue";
  import SocialLinks from "../social-links/SocialLinks.vue";
  import "./layout.css";

  const apiStore = useApiStore();
  const hasLogin = computed(function hasAvailableLogin() {
    return Boolean(apiStore.client || apiStore.hasStoredCredentials);
  });
</script>

<template>
  <div id="unauthed-content">
    <div data-nosnippet>
      <header class="public-header">
        <RouterLink :to="hasLogin ? '/group/items' : '/'" class="brand" aria-label="GIM hub home">
          <CachedImage class="brand-logo" src="/images/logo-quarter.webp" alt="GIM hub" />
        </RouterLink>
        <nav aria-label="Main navigation">
          <RouterLink to="/changelog" class="public-changelog">What's new</RouterLink>
          <RouterLink :to="hasLogin ? '/group' : '/login'">{{ hasLogin ? "Your group" : "Sign in" }}</RouterLink>
          <RouterLink to="/create-group" class="men-button button-primary">Get started</RouterLink>
        </nav>
      </header>
    </div>
    <main class="public-page">
      <slot />
    </main>
    <div data-nosnippet>
      <footer class="public-footer">
        <p>GIM hub</p>
        <SocialLinks />
      </footer>
    </div>
  </div>
</template>
