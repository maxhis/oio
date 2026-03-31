<script setup lang="ts">
import type { Category } from "../data/navigation";
import SiteCard from "./SiteCard.vue";

defineProps<{
  category: Category;
}>();
</script>

<template>
  <section class="category-section" :data-category-title="category.title">
    <h4 class="text-gray">
      <i
        :id="category.title"
        class="linecons-tag"
        style="margin-right: 7px"
      ></i>
      {{ category.title }}
    </h4>
    <div class="row">
      <SiteCard
        v-for="site in category.sites"
        :key="`${category.title}-${site.title}`"
        :site="site"
      />
    </div>
    <br />
  </section>
</template>
