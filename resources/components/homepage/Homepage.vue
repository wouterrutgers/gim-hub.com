<script setup>
  import { computed } from "vue";
  import { useApiStore } from "../../stores/api";
  import AppLink from "../app-link/AppLink.vue";
  import CachedImage from "../cached-image/CachedImage.vue";
  import "./homepage.css";

  const apiStore = useApiStore();
  const hasLogin = computed(function hasAvailableLogin() {
    return Boolean(apiStore.client || apiStore.hasStoredCredentials);
  });

  const features = [
    { icon: "/ui/777-0.png", title: "Group items", description: "Search everyone's banks, inventories, and storage." },
    { icon: "/ui/world-map.png", title: "World map", description: "Find your teammates and follow their locations." },
    {
      icon: "/ui/3579-0.png",
      title: "Skills and activity",
      description: "Compare experience gains and keep up with drops and milestones.",
    },
  ];
</script>

<template>
  <div id="homepage">
    <div class="homepage-introduction">
      <CachedImage class="homepage-logo" alt="GIM hub" src="/images/logo-quarter.webp" />
      <p>A companion for your Group Ironman team.</p>
    </div>
    <section class="homepage-welcome rsborder rsbackground" aria-labelledby="homepage-heading">
      <header>
        <h1 id="homepage-heading">Welcome to GIM hub</h1>
        <p>See what your group has, where everyone is, and how far you've come.</p>
      </header>
      <div class="homepage-tools">
        <div v-for="feature in features" :key="feature.title" class="homepage-tool">
          <CachedImage alt="" :src="feature.icon" width="30" height="30" />
          <div>
            <h2>{{ feature.title }}</h2>
            <p>{{ feature.description }}</p>
          </div>
        </div>
      </div>
      <div id="homepage-links">
        <AppLink href="/create-group" class="button-primary">Create a group</AppLink>
        <AppLink :href="hasLogin ? '/group' : '/login'">{{ hasLogin ? "Open your group" : "Sign in" }}</AppLink>
      </div>
      <p class="homepage-demo-link"><RouterLink to="/demo">Try the demo</RouterLink> to have a look around.</p>
      <footer>
        <span>Free to use with RuneLite</span>
        <RouterLink to="/setup-instructions">Plugin setup</RouterLink>
      </footer>
    </section>
  </div>
</template>
