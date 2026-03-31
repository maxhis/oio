<script setup lang="ts">
import { RouterLink } from "vue-router";

import type { Category } from "../data/navigation";

defineProps<{
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
</script>

<template>
  <aside
    class="sidebar-menu toggle-others fixed"
    :class="{ collapsed: isCollapsed }"
  >
    <div class="sidebar-menu-inner">
      <header class="logo-env">
        <div class="logo">
          <RouterLink to="/" class="logo-expanded">
            <img :src="'/assets/images/logo@2x.svg'" width="100%" alt="oio.dev" />
          </RouterLink>
          <RouterLink to="/" class="logo-collapsed">
            <img
              :src="'/assets/images/logo-collapsed@2x.png'"
              width="40"
              alt="oio.dev"
            />
          </RouterLink>
        </div>
        <div class="mobile-menu-toggle visible-xs">
          <a href="#" @click.prevent="emit('toggleMobileMenu')">
            <i class="fa-bars"></i>
          </a>
        </div>
      </header>

      <ul
        id="main-menu"
        class="main-menu"
        :class="{ 'mobile-is-visible': isMobileVisible }"
      >
        <li
          v-for="category in categories"
          :key="category.title"
          :class="{ active: activeCategory === category.title }"
        >
          <a
            :href="`#${category.title}`"
            class="smooth"
            @click.prevent="emit('selectCategory', category.title)"
          >
            <i :class="category.icon"></i>
            <span class="title">{{ category.title }}</span>
          </a>
        </li>
      </ul>

      <ul class="main-menu" :class="{ 'mobile-is-visible': isMobileVisible }">
        <li>
          <RouterLink to="/about">
            <i class="linecons-heart"></i>
            <span class="tooltip-blue">关于本站</span>
          </RouterLink>
        </li>
        <li>
          <a href="mailto:mail.oio.dev@gmail.com">
            <i class="linecons-mail"></i>
            <span class="tooltip-blue">我要投稿</span>
            <span class="label label-primary pull-right hidden-collapsed">♥︎</span>
          </a>
        </li>
      </ul>
    </div>
  </aside>
</template>
