<script setup lang="ts">
import type { Category } from "../data/navigation";
import { categoryIcons } from "../icons";
import SiteCard from "./SiteCard.vue";

const props = defineProps<{
  category: Category;
}>();

function getCategoryIcon(icon: string) {
  return categoryIcons[icon] ?? categoryIcons.featured;
}
</script>

<template>
  <section :id="props.category.title" class="category-section">
    <header class="category-section__header">
      <h2 class="category-section__title">
        <component
          :is="getCategoryIcon(props.category.icon)"
          :size="20"
          :stroke-width="2.1"
        />
        <span>{{ props.category.title }}</span>
      </h2>
    </header>
    <div class="site-grid">
      <SiteCard
        v-for="site in props.category.sites"
        :key="`${props.category.title}-${site.title}`"
        :category-title="props.category.title"
        :site="site"
      />
    </div>
  </section>
</template>
