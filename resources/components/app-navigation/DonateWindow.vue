<script setup>
  import CachedImage from "../cached-image/CachedImage.vue";
  import "./donate-window.css";

  const emit = defineEmits(["close"]);

  const donationLinks = [
    {
      label: "GitHub sponsors",
      href: "https://github.com/sponsors/wouterrutgers",
      imageSource: "/images/github-light.webp",
      preferred: true,
    },
    { label: "Ko-fi", href: "https://ko-fi.com/wouterrutgers", imageSource: "/images/kofi.webp" },
    { label: "PayPal", href: "https://paypal.me/wouterrutgers", imageSource: "/images/paypal.svg" },
  ];
</script>

<template>
  <div
    id="donate-window"
    class="rsborder rsbackground"
    role="dialog"
    aria-modal="true"
    aria-labelledby="donate-window-title"
  >
    <div class="donate-window-header">
      <h2 id="donate-window-title">Support GIM hub</h2>
      <button type="button" class="dialog-close" aria-label="Close dialog" @click="emit('close')">
        <CachedImage src="/ui/1731-0.png" alt="" />
      </button>
    </div>
    <p>
      I enjoy building GIM hub and sharing it with you. If you'd like to say thanks, a small donation is always
      appreciated.
    </p>
    <div class="donate-window-links">
      <a
        v-for="link in donationLinks"
        :key="link.href"
        :href="link.href"
        :class="['donate-window-link', { 'donate-window-link-preferred': link.preferred }]"
        target="_blank"
        rel="noopener noreferrer"
      >
        <CachedImage :src="link.imageSource" alt="" />
        <span>{{ link.label }}</span>
        <span v-if="link.preferred" class="donate-window-preferred">Preferred</span>
      </a>
    </div>
  </div>
</template>
