<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";

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
  "main-footer",
  "sticky",
  "footer-type-1",
  { fixed: props.fixed },
]);

function scrollToTop(event: Event) {
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
</script>

<template>
  <footer :class="footerClass">
    <div class="footer-inner">
      <div class="footer-text">
        {{ copyrightText }}
        <RouterLink to="/"><strong>oio.dev</strong></RouterLink>
        created by
        <a href="https://go.oio.dev/blog" target="_blank" rel="noreferrer">
          <strong>iStar</strong>
        </a>
      </div>
      <div class="go-up">
        <a href="#" rel="go-top" @click="scrollToTop">
          <i class="fa-angle-up"></i>
        </a>
      </div>
    </div>
  </footer>
</template>
