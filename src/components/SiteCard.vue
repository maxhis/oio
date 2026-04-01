<script setup lang="ts">
import type { SiteLink } from "../data/navigation";
import { computed } from "vue";

const props = defineProps<{
  site: SiteLink;
}>();

const iconSrc = computed(() => props.site.iconUrl ?? `/assets/images/logos/${props.site.icon}`);
</script>

<template>
  <article class="site-card">
    <a
      class="site-card__link"
      :href="site.url"
      target="_blank"
      rel="noreferrer"
      :title="site.displayLink"
    >
      <div class="site-card__icon-wrap">
        <img
          :src="iconSrc"
          class="site-card__icon"
          width="44"
          height="44"
          :alt="site.title"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div class="site-card__body">
        <div class="site-card__title">{{ site.title }}</div>
        <p class="site-card__desc">{{ site.subTitle }}</p>
        <div class="site-card__meta">{{ site.displayLink }}</div>
      </div>
    </a>
  </article>
</template>
