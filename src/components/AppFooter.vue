<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";

import { uiIcons } from "../icons";

const props = withDefaults(
  defineProps<{
    fixed?: boolean;
  }>(),
  {
    fixed: false,
  },
);

const copyrightText = computed(() => {
  const currentYear = new Date().getFullYear();
  return currentYear > 2019 ? `© 2019-${currentYear}` : "© 2019";
});

const footerClass = computed(() => [
  "site-footer",
  { fixed: props.fixed },
]);

const ChevronUpIcon = uiIcons.chevronUp;

function scrollToTop(event: Event) {
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
</script>

<template>
  <footer :class="footerClass">
    <div class="site-footer__inner">
      <div class="site-footer__text">
        {{ copyrightText }}
        <RouterLink to="/"><strong>OIO</strong></RouterLink>
        by
        <a href="https://go.15tar.com/blog" target="_blank" rel="noreferrer">
          <strong>iStar</strong>
        </a>
      </div>
      <div class="site-footer__top">
        <a href="#" rel="go-top" @click="scrollToTop" aria-label="回到顶部">
          <ChevronUpIcon :size="18" :stroke-width="2.2" />
        </a>
      </div>
    </div>
  </footer>
</template>
