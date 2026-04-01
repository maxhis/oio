<script setup lang="ts">
import { RouterLink } from "vue-router";

import { categoryIcons, uiIcons } from "../icons";
import type { Category } from "../data/navigation";

const props = defineProps<{
  categories: Category[];
  activeCategory: string;
  isCollapsed: boolean;
  isMobileVisible: boolean;
}>();

const emit = defineEmits<{
  (event: "toggleSidebar"): void;
  (event: "toggleMobileMenu"): void;
  (event: "selectCategory", title: string): void;
}>();

const MenuIcon = uiIcons.menu;
const CloseIcon = uiIcons.close;
const HeartIcon = uiIcons.heart;
const MailIcon = uiIcons.mail;
const submissionEmail = `${["mail", "oio", "dev"].join(".")}@gmail.com`;
const submissionMailto = `mailto:${submissionEmail}`;

function getCategoryIcon(icon: string) {
  return categoryIcons[icon] ?? categoryIcons.featured;
}

</script>

<template>
  <aside
    class="site-sidebar"
    :class="{
      'site-sidebar--collapsed': isCollapsed,
      'site-sidebar--open': isMobileVisible,
    }"
  >
    <header class="site-sidebar__header">
      <RouterLink to="/" class="site-brand">
        <span class="site-brand__badge" aria-hidden="true">
          <img src="/assets/images/logo-mark.svg" class="site-brand__mark" alt="" />
        </span>
        <span class="site-brand__copy">
          <span class="site-brand__domain">oio.15tar.com</span>
          <span class="site-brand__text">开发者网址导航</span>
        </span>
      </RouterLink>

      <div class="site-sidebar__actions">
        <button
          type="button"
          class="site-sidebar__toggle site-sidebar__toggle--desktop"
          @click="emit('toggleSidebar')"
          aria-label="切换侧边栏"
        >
          <MenuIcon :size="18" :stroke-width="2.1" />
        </button>
        <button
          type="button"
          class="site-sidebar__toggle site-sidebar__toggle--mobile"
          @click="emit('toggleMobileMenu')"
          aria-label="关闭菜单"
        >
          <CloseIcon :size="18" :stroke-width="2.1" />
        </button>
      </div>
    </header>

    <div class="site-sidebar__intro">
      <p class="site-sidebar__kicker">oio.15tar.com</p>
      <p class="site-sidebar__blurb">
        收集经常回访、值得长期保存的开发资源，把书签整理成真正可浏览的索引。
      </p>
    </div>

    <nav class="site-sidebar__nav" aria-label="分类导航">
      <button
        v-for="category in categories"
        :key="category.title"
        type="button"
        class="site-sidebar__link"
        :class="{ 'is-active': activeCategory === category.title }"
        :aria-current="activeCategory === category.title ? 'true' : undefined"
        @click="emit('selectCategory', category.title)"
      >
        <component :is="getCategoryIcon(category.icon)" :size="18" :stroke-width="2" />
        <span class="site-sidebar__label">{{ category.title }}</span>
      </button>
    </nav>

    <div class="site-sidebar__footer">
      <RouterLink to="/about" class="site-sidebar__secondary-link">
        <HeartIcon :size="18" :stroke-width="2" />
        <span class="site-sidebar__label">关于本站</span>
      </RouterLink>
      <a :href="submissionMailto" class="site-sidebar__secondary-link">
        <MailIcon :size="18" :stroke-width="2" />
        <span class="site-sidebar__label">我要投稿</span>
      </a>
    </div>
  </aside>
</template>
