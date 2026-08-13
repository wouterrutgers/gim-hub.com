<script setup>
  import CachedImage from "../cached-image/CachedImage.vue";
  import "./social-links.css";
</script>

<template>
  <div id="top-left-links">
    <div class="social-links rsbackground rsborder-tiny">
      <a
        class="homepage-link"
        href="https://github.com/wouterrutgers/gim-hub.com"
        data-tooltip="GitHub"
        target="_blank"
      >
        <CachedImage alt="GitHub logo" src="/images/github-light.webp" height="24" />
        GitHub
      </a>
    </div>
    <div class="social-links rsbackground rsborder-tiny">
      <a class="homepage-link" href="https://discord.gg/ZwzW6yYD8V" data-tooltip="Discord" target="_blank">
        <CachedImage alt="Discord logo" src="/images/discord-light.webp" height="24" />
        Discord
      </a>
    </div>
  </div>

  <div id="bottom-right-links">
    <div class="social-links rsbackground rsborder-tiny">
      <a class="homepage-link" href="https://x.com/nin_tan_" data-tooltip="Logo by @nin_tan_ on X.com" target="_blank">
        <CachedImage alt="X logo" src="/images/x-white.webp" height="16" />
        Logo by @nin_tan_
      </a>
    </div>
  </div>
</template>
