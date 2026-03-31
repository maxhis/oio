<script setup lang="ts">
import type { SiteLink } from "../data/navigation";

defineProps<{
  site: SiteLink;
}>();
</script>

<template>
  <div class="col-sm-3 col-xs-12">
    <a
      class="xe-widget xe-conversations box2"
      :href="site.url"
      target="_blank"
      rel="noreferrer"
      :title="site.displayLink"
    >
      <div class="xe-comment-entry">
        <img
          :src="`/assets/images/logos/${site.icon}`"
          class="img-circle"
          width="40"
          :alt="site.title"
        />
        <div class="xe-comment">
          <div class="xe-user-name overflowClip_1">
            <strong>{{ site.title }}</strong>
          </div>
          <p class="overflowClip_2">{{ site.subTitle }}</p>
        </div>
      </div>
    </a>
  </div>
</template>
