<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";

import AppFooter from "../components/AppFooter.vue";
import CategorySection from "../components/CategorySection.vue";
import SidebarMenu from "../components/SidebarMenu.vue";
import { navigationCategories } from "../data/navigation";

const categories = navigationCategories;
const activeCategory = ref(categories[0]?.title ?? "");
const isSidebarCollapsed = ref(false);
const isMobileMenuVisible = ref(false);

function scrollToCategory(title: string) {
  const target = document.getElementById(title);

  if (!target) {
    return;
  }

  const top = target.getBoundingClientRect().top + window.scrollY - 30;
  window.scrollTo({ top, behavior: "smooth" });
  activeCategory.value = title;
  window.history.replaceState(null, "", `/#${encodeURIComponent(title)}`);
  isMobileMenuVisible.value = false;
  document.body.classList.remove("menu-mobile-open");
}

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
}

function toggleMobileMenu() {
  isMobileMenuVisible.value = !isMobileMenuVisible.value;
  document.body.classList.toggle("menu-mobile-open", isMobileMenuVisible.value);
}

function closeMobileMenu() {
  isMobileMenuVisible.value = false;
  document.body.classList.remove("menu-mobile-open");
}

function syncActiveCategory() {
  const offset = window.scrollY + 140;
  let current = categories[0]?.title ?? "";

  for (const category of categories) {
    const element = document.getElementById(category.title);

    if (!element) {
      continue;
    }

    if (element.getBoundingClientRect().top + window.scrollY - 60 <= offset) {
      current = category.title;
    }
  }

  activeCategory.value = current;
}

function scrollToInitialHash() {
  const hash = window.location.hash;

  if (!hash) {
    return;
  }

  const title = decodeURIComponent(hash.slice(1));
  const target = document.getElementById(title);

  if (target) {
    const top = target.getBoundingClientRect().top + window.scrollY - 30;
    window.scrollTo({ top });
    activeCategory.value = title;
  }
}

onMounted(async () => {
  window.addEventListener("scroll", syncActiveCategory, { passive: true });
  window.addEventListener("resize", closeMobileMenu);
  await nextTick();
  scrollToInitialHash();
  syncActiveCategory();
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", syncActiveCategory);
  window.removeEventListener("resize", closeMobileMenu);
  document.body.classList.remove("menu-mobile-open");
});
</script>

<template>
  <div class="page-container home-page">
    <SidebarMenu
      :categories="categories"
      :active-category="activeCategory"
      :is-collapsed="isSidebarCollapsed"
      :is-mobile-visible="isMobileMenuVisible"
      @toggle-sidebar="toggleSidebar"
      @toggle-mobile-menu="toggleMobileMenu"
      @select-category="scrollToCategory"
    />

    <div
      class="mobile-menu-backdrop"
      :class="{ visible: isMobileMenuVisible }"
      @click="closeMobileMenu"
    ></div>

    <main class="main-content">
      <nav
        class="navbar user-info-navbar"
        :class="{ 'mobile-is-visible': isMobileMenuVisible }"
        role="navigation"
      >
        <ul class="user-info-menu left-links list-inline list-unstyled">
          <li class="hidden-sm hidden-xs">
            <a href="#" data-toggle="sidebar" @click.prevent="toggleSidebar">
              <i class="fa-bars"></i>
            </a>
          </li>
          <li class="visible-xs">
            <a href="#" @click.prevent="toggleMobileMenu">
              <i class="fa-bars"></i>
            </a>
          </li>
        </ul>
      </nav>

      <CategorySection
        v-for="category in categories"
        :key="category.title"
        :category="category"
      />

      <AppFooter />
    </main>
  </div>
</template>
