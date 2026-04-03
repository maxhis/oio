<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
  import { RouterLink } from "vue-router";

  import AppFooter from "../components/AppFooter.vue";
  import CategorySection from "../components/CategorySection.vue";
  import SidebarMenu from "../components/SidebarMenu.vue";
  import { type Category } from "../data/navigation";
  import { uiIcons } from "../icons";
  import { getInitialNavigationCategories, loadNavigationCategories } from "../services/navigation";
  import {
    createEmptySiteSubmissionInput,
    submitSiteSubmission,
    type SiteSubmissionInput,
  } from "../services/submissions";

  const categories = ref<Category[]>(getInitialNavigationCategories());
  const activeCategory = ref(categories.value[0]?.title ?? "");
  const isSidebarCollapsed = ref(false);
  const isMobileMenuVisible = ref(false);
  const isSubmissionModalOpen = ref(false);
  const isSubmissionSubmitting = ref(false);
  const submissionErrorMessage = ref("");
  const submissionSuccessMessage = ref("");
  const submissionForm = ref<SiteSubmissionInput>(createEmptySiteSubmissionInput());
  const submissionWebsiteInput = ref<HTMLInputElement | null>(null);
  const MenuIcon = uiIcons.menu;
  const CloseIcon = uiIcons.close;
  const totalSites = computed(() =>
    categories.value.reduce((count, category) => count + category.sites.length, 0),
  );
  const submissionDescriptionLength = computed(() => submissionForm.value.description.length);

  let scrollFrame = 0;
  let resizeFrame = 0;
  let categoryOffsets: Array<{ title: string; top: number }> = [];

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

  function resetSubmissionForm() {
    submissionForm.value = createEmptySiteSubmissionInput();
  }

  function openSubmissionModal() {
    closeMobileMenu();
    submissionErrorMessage.value = "";
    submissionSuccessMessage.value = "";
    isSubmissionModalOpen.value = true;
  }

  function closeSubmissionModal() {
    if (isSubmissionSubmitting.value) {
      return;
    }

    isSubmissionModalOpen.value = false;
    submissionErrorMessage.value = "";
  }

  async function submitSubmission() {
    submissionErrorMessage.value = "";
    submissionSuccessMessage.value = "";

    const website = submissionForm.value.website.trim();
    const description = submissionForm.value.description.trim();

    if (!website) {
      submissionErrorMessage.value = "请先填写站点地址。";
      await nextTick();
      submissionWebsiteInput.value?.focus();
      return;
    }

    if (!description) {
      submissionErrorMessage.value = "请补充站点简介，方便我判断是否收录。";
      return;
    }

    isSubmissionSubmitting.value = true;

    try {
      await submitSiteSubmission(submissionForm.value);
      resetSubmissionForm();
      submissionSuccessMessage.value = "投稿已收到，后续会尽快处理。";
    } catch (error) {
      submissionErrorMessage.value = error instanceof Error ? error.message : "投稿提交失败，请稍后再试。";
    } finally {
      isSubmissionSubmitting.value = false;
    }
  }

  function syncActiveCategory() {
    const offset = window.scrollY + 140;
    let current = categories.value[0]?.title ?? "";

    for (const category of categoryOffsets) {
      if (category.top <= offset) {
        current = category.title;
      }
    }

    if (activeCategory.value !== current) {
      activeCategory.value = current;
    }
  }

  function measureCategoryOffsets() {
    categoryOffsets = categories.value
      .map((category) => {
        const element = document.getElementById(category.title);

        if (!element) {
          return null;
        }

        return {
          title: category.title,
          top: Math.max(0, element.offsetTop - 60),
        };
      })
      .filter((item): item is { title: string; top: number } => item !== null);
  }

  function requestSyncActiveCategory() {
    if (scrollFrame) {
      return;
    }

    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      syncActiveCategory();
    });
  }

  function handleResize() {
    closeMobileMenu();

    if (resizeFrame) {
      window.cancelAnimationFrame(resizeFrame);
    }

    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      measureCategoryOffsets();
      syncActiveCategory();
    });
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

  function applyCategories(nextCategories: Category[]) {
    categories.value = nextCategories;

    if (!nextCategories.some((category) => category.title === activeCategory.value)) {
      activeCategory.value = nextCategories[0]?.title ?? "";
    }
  }

  onMounted(async () => {
    window.addEventListener("scroll", requestSyncActiveCategory, { passive: true });
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleWindowKeydown);

    applyCategories(await loadNavigationCategories());
    await nextTick();
    measureCategoryOffsets();
    scrollToInitialHash();
    measureCategoryOffsets();
    syncActiveCategory();
  });

  onBeforeUnmount(() => {
    if (scrollFrame) {
      window.cancelAnimationFrame(scrollFrame);
    }

    if (resizeFrame) {
      window.cancelAnimationFrame(resizeFrame);
    }

    window.removeEventListener("scroll", requestSyncActiveCategory);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("keydown", handleWindowKeydown);
    document.body.classList.remove("menu-mobile-open");
    document.body.classList.remove("submission-modal-open");
  });

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && isSubmissionModalOpen.value) {
      closeSubmissionModal();
    }
  }

  watch(isSubmissionModalOpen, async (open) => {
    if (typeof document === "undefined") {
      return;
    }

    document.body.classList.toggle("submission-modal-open", open);

    if (open) {
      await nextTick();
      submissionWebsiteInput.value?.focus();
    }
  });
</script>

<template>
  <div class="site-shell home-page" :class="{
    'is-collapsed': isSidebarCollapsed,
    'is-mobile-menu-open': isMobileMenuVisible,
  }">
    <SidebarMenu :categories="categories" :active-category="activeCategory" :is-collapsed="isSidebarCollapsed"
      :is-mobile-visible="isMobileMenuVisible" @toggle-sidebar="toggleSidebar" @toggle-mobile-menu="toggleMobileMenu"
      @select-category="scrollToCategory" @open-submission-modal="openSubmissionModal" />

    <div class="site-shell__backdrop" :class="{ visible: isMobileMenuVisible }" @click="closeMobileMenu"></div>

    <main class="site-main">
      <header class="site-mobilebar">
        <button type="button" class="site-mobilebar__toggle" @click="toggleMobileMenu" aria-label="打开导航菜单">
          <MenuIcon :size="18" :stroke-width="2.1" />
        </button>
        <RouterLink to="/" class="site-mobilebar__brand">OIO</RouterLink>
      </header>

      <section class="hero-panel">
        <div class="hero-panel__content">
          <h1 class="hero-panel__title">少翻收藏夹，多写代码。</h1>
          <p class="hero-panel__description">
            把散落在浏览器角落的开发工具、文档与灵感站点，按使用场景整理成一份随时可查的索引。
          </p>
        </div>
        <div class="hero-panel__stats">
          <div class="hero-stat">
            <span class="hero-stat__value">{{ categories.length }}</span>
            <span class="hero-stat__label">分类</span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat__value">
              {{ totalSites }}
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

    <Teleport to="body">
      <div v-if="isSubmissionModalOpen" class="submission-modal-backdrop" @click.self="closeSubmissionModal">
        <section class="submission-modal" role="dialog" aria-modal="true" aria-labelledby="submission-modal-title">
          <header class="submission-modal__header">
            <div>
              <p class="site-sidebar__kicker">Share A Site</p>
              <h2 id="submission-modal-title">推荐一个值得收录的站点</h2>
              <p>
                填写站点地址、简介和联系方式后，就可以直接提交投稿。
              </p>
            </div>

            <button type="button" class="submission-modal__close" aria-label="关闭投稿弹窗" @click="closeSubmissionModal">
              <CloseIcon :size="18" :stroke-width="2.1" />
            </button>
          </header>

          <form class="submission-form" @submit.prevent="submitSubmission">
            <label class="submission-field">
              <span class="submission-field__label">网站</span>
              <input
                ref="submissionWebsiteInput"
                v-model="submissionForm.website"
                type="url"
                name="website"
                placeholder="https://example.com"
                autocomplete="url"
                :disabled="isSubmissionSubmitting"
              />
            </label>

            <label class="submission-field">
              <span class="submission-field__label">简介</span>
              <textarea
                v-model="submissionForm.description"
                name="description"
                rows="5"
                maxlength="1200"
                placeholder="这个网站解决什么问题，为什么值得长期收藏。"
                :disabled="isSubmissionSubmitting"
              ></textarea>
              <span class="submission-field__hint">{{ submissionDescriptionLength }}/1200</span>
            </label>

            <label class="submission-field">
              <span class="submission-field__label">联系方式 <em>可选</em></span>
              <input
                v-model="submissionForm.contact"
                type="text"
                name="contact"
                maxlength="200"
                placeholder="Telegram / 微信 / 邮箱"
                autocomplete="off"
                :disabled="isSubmissionSubmitting"
              />
            </label>

            <label class="submission-field submission-field--honeypot" aria-hidden="true">
              <span class="submission-field__label">Company</span>
              <input
                v-model="submissionForm.company"
                type="text"
                name="company"
                tabindex="-1"
                autocomplete="organization"
                :disabled="isSubmissionSubmitting"
              />
            </label>

            <p v-if="submissionErrorMessage" class="submission-feedback submission-feedback--error">
              {{ submissionErrorMessage }}
            </p>
            <p v-else-if="submissionSuccessMessage" class="submission-feedback submission-feedback--success">
              {{ submissionSuccessMessage }}
            </p>

            <div class="submission-modal__actions">
              <button type="button" class="submission-button submission-button--ghost" :disabled="isSubmissionSubmitting"
                @click="closeSubmissionModal">
                取消
              </button>
              <button type="submit" class="submission-button submission-button--primary" :disabled="isSubmissionSubmitting">
                {{ isSubmissionSubmitting ? "提交中..." : "发送投稿" }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>
  </div>
</template>
