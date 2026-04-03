<script setup lang="ts">
import type { SiteLink } from "../data/navigation";
import { computed } from "vue";

import { trackOutboundClick } from "../services/analytics";

const props = defineProps<{
  categoryTitle: string;
  site: SiteLink;
}>();

const iconSrc = computed(() => props.site.iconUrl ?? `/assets/images/logos/${props.site.icon}`);

function handleClick() {
  trackOutboundClick({
    categoryTitle: props.categoryTitle,
    destinationUrl: props.site.url,
    displayLink: props.site.displayLink,
    siteTitle: props.site.title,
  });
}
</script>

<template>
  <article class="site-card">
    <a
      @click="handleClick"
      class="site-card__link"
      :href="site.url"
      target="_blank"
      rel="noreferrer"
      :aria-label="`${site.title} (${site.displayLink})`"
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
      </div>
    </a>
  </article>
</template>
