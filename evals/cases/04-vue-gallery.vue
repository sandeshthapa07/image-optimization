<!-- Eval 04: Vue 3 gallery page (Vite SPA, no SSR) -->
<script setup lang="ts">
defineProps<{ hero: { src: string; alt: string }; photos: { src: string; srcset: string; alt: string }[] }>();
</script>

<template>
  <!-- bug: hero uses a JavaScript lazy directive and has no dimensions -->
  <img class="hero" v-lazy="hero.src" :alt="hero.alt" />

  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <!-- bug: Tailwind fixed width and height, no object-cover; srcset string without sizes -->
    <img
      v-for="p in photos"
      :key="p.src"
      :src="p.src"
      srcset="/img/a-400.jpg 400w, /img/a-800.jpg 800w, /img/a-1200.jpg 1200w"
      class="w-full h-64 rounded-lg"
      width="1200"
      height="800"
      :alt="p.alt"
      loading="lazy"
    />
  </div>

  <!-- bug: animated GIF -->
  <img src="/img/how-it-works.gif" width="640" height="360" alt="How it works" loading="lazy" />
</template>
