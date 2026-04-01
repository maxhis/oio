<script setup lang="ts">
  import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
  import { RouterLink } from "vue-router";

  import AppFooter from "../components/AppFooter.vue";
  import CategorySection from "../components/CategorySection.vue";
  import SidebarMenu from "../components/SidebarMenu.vue";
  import { navigationCategories } from "../data/navigation";
  import { uiIcons } from "../icons";

  const categories = navigationCategories;
  const activeCategory = ref(categories[0]?.title ?? "");
  const isSidebarCollapsed = ref(false);
  const isMobileMenuVisible = ref(false);
  const MenuIcon = uiIcons.menu;

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
  <div class="site-shell home-page" :class="{
    'is-collapsed': isSidebarCollapsed,
    'is-mobile-menu-open': isMobileMenuVisible,
  }">
    <SidebarMenu :categories="categories" :active-category="activeCategory" :is-collapsed="isSidebarCollapsed"
      :is-mobile-visible="isMobileMenuVisible" @toggle-sidebar="toggleSidebar" @toggle-mobile-menu="toggleMobileMenu"
      @select-category="scrollToCategory" />

    <div class="site-shell__backdrop" :class="{ visible: isMobileMenuVisible }" @click="closeMobileMenu"></div>

    <main class="site-main">
      <header class="site-mobilebar">
        <button type="button" class="site-mobilebar__toggle" @click="toggleMobileMenu" aria-label="打开导航菜单">
          <MenuIcon :size="18" :stroke-width="2.1" />
        </button>
        <RouterLink to="/" class="site-mobilebar__brand">oio.dev</RouterLink>
      </header>

      <section class="hero-panel">
        <div class="hero-panel__content">
          <p class="hero-panel__eyebrow">Developer Index</p>
          <h1 class="hero-panel__title">把常用开发资源整理成一份真正可浏览的索引。</h1>
          <p class="hero-panel__description">
            从大前端到大后端，从学习资源到日常工具，把容易遗失在收藏夹里的站点按使用场景归档。
          </p>
        </div>
        <div class="hero-panel__stats">
          <div class="hero-stat">
            <span class="hero-stat__value">{{ categories.length }}</span>
            <span class="hero-stat__label">分类</span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat__value">
              {{categories.reduce((count, category) => count + category.sites.length, 0)}}
            </span>
            <span class="hero-stat__label">站点</span>
          </div>
        </div>
      </section>

      <div class="category-list">
        <CategorySection v-for="category in categories" :key="category.title" :category="category" />
      </div>

      <AppFooter />
    </main>
  </div>
</template>
