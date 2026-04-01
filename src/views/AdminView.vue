<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";

import {
  createAdminCategory,
  createAdminSite,
  createEmptyCategoryInput,
  createEmptySiteInput,
  deleteAdminCategory,
  deleteAdminSite,
  loadAdminNavigation,
  loadAdminSession,
  reorderAdminCategories,
  reorderAdminSites,
  updateAdminCategory,
  updateAdminSite,
  type AdminCategory,
  type AdminSession,
  type AdminSite,
  type CategoryInput,
  type SiteInput,
} from "../services/admin";

type FormMode = "create" | "edit";

const session = ref<AdminSession | null>(null);
const source = ref("loading");
const categories = ref<AdminCategory[]>([]);
const selectedCategoryId = ref<number | null>(null);
const selectedSiteId = ref<number | null>(null);
const categoryMode = ref<FormMode>("create");
const siteMode = ref<FormMode>("create");
const categoryDraft = ref<CategoryInput>(createEmptyCategoryInput());
const siteDraft = ref<SiteInput>(createEmptySiteInput());
const isCategoryModalOpen = ref(false);
const isSiteModalOpen = ref(false);
const isLoading = ref(true);
const busyKey = ref("");
const notice = ref("");
const errorMessage = ref("");

const selectedCategory = computed(() =>
  categories.value.find((category) => category.id === selectedCategoryId.value) ?? null,
);

const sitesInSelectedCategory = computed(() => selectedCategory.value?.sites ?? []);

const selectedSite = computed(() =>
  sitesInSelectedCategory.value.find((site) => site.id === selectedSiteId.value) ?? null,
);

const totalSites = computed(() =>
  categories.value.reduce((count, category) => count + category.sites.length, 0),
);

const categoryFormIssues = computed(() => {
  const issues: string[] = [];

  if (!categoryDraft.value.title.trim()) {
    issues.push("分类名称不能为空。");
  }

  if (!categoryDraft.value.icon.trim()) {
    issues.push("分类图标不能为空。");
  }

  return issues;
});

const siteFormIssues = computed(() => {
  const issues: string[] = [];

  if (!siteDraft.value.categoryId) {
    issues.push("站点必须归属一个分类。");
  }

  if (!siteDraft.value.title.trim()) {
    issues.push("站点标题不能为空。");
  }

  if (!siteDraft.value.subTitle.trim()) {
    issues.push("站点副标题不能为空。");
  }

  if (!siteDraft.value.displayLink.trim()) {
    issues.push("展示链接不能为空。");
  }

  if (!siteDraft.value.url.trim()) {
    issues.push("跳转 URL 不能为空。");
  }

  if (!siteDraft.value.icon.trim()) {
    issues.push("图标文件不能为空。");
  }

  return issues;
});

const categoryStatus = computed(() => {
  if (busyKey.value === "save-category") {
    return "分类写入中";
  }

  if (busyKey.value === "delete-category") {
    return "分类删除中";
  }

  if (busyKey.value === "reorder-category") {
    return "分类排序中";
  }

  return categoryMode.value === "create" ? "新建分类" : "编辑分类";
});

const siteStatus = computed(() => {
  if (busyKey.value === "save-site") {
    return "站点写入中";
  }

  if (busyKey.value === "delete-site") {
    return "站点删除中";
  }

  if (busyKey.value === "reorder-site") {
    return "站点排序中";
  }

  return siteMode.value === "create" ? "新建站点" : "编辑站点";
});

const pageStatus = computed(() => {
  if (isLoading.value) {
    return "读取中";
  }

  if (busyKey.value) {
    return "正在提交 CRUD 操作";
  }

  return "逐项保存";
});

const hasCategories = computed(() => categories.value.length > 0);
const hasSelectedCategory = computed(() => Boolean(selectedCategory.value));
const isAnyModalOpen = computed(() => isCategoryModalOpen.value || isSiteModalOpen.value);

function clearFeedback() {
  notice.value = "";
  errorMessage.value = "";
}

function isBusy(key?: string): boolean {
  if (!key) {
    return isLoading.value || Boolean(busyKey.value);
  }

  return isLoading.value || busyKey.value === key;
}

function confirmDanger(message: string): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  return window.confirm(message);
}

function fillCategoryDraft(category: AdminCategory | null) {
  categoryDraft.value = category
    ? {
      title: category.title,
      icon: category.icon,
    }
    : createEmptyCategoryInput();
}

function fillSiteDraft(site: AdminSite | null, fallbackCategoryId = selectedCategoryId.value ?? 0) {
  siteDraft.value = site
    ? {
      categoryId: site.categoryId,
      title: site.title,
      subTitle: site.subTitle,
      displayLink: site.displayLink,
      url: site.url,
      icon: site.icon,
    }
    : createEmptySiteInput(fallbackCategoryId);
}

function applySelection(nextCategoryId?: number | null, nextSiteId?: number | null) {
  const fallbackCategory = nextCategoryId
    ? categories.value.find((category) => category.id === nextCategoryId) ?? categories.value[0] ?? null
    : categories.value.find((category) => category.id === selectedCategoryId.value) ?? categories.value[0] ?? null;

  selectedCategoryId.value = fallbackCategory?.id ?? null;

  const nextSites = fallbackCategory?.sites ?? [];
  const fallbackSite = nextSiteId
    ? nextSites.find((site) => site.id === nextSiteId) ?? nextSites[0] ?? null
    : nextSites.find((site) => site.id === selectedSiteId.value) ?? nextSites[0] ?? null;

  selectedSiteId.value = fallbackSite?.id ?? null;
}

async function refreshAdminData(selection?: { categoryId?: number | null; siteId?: number | null }) {
  clearFeedback();
  isLoading.value = true;

  try {
    const [nextSession, navigation] = await Promise.all([
      loadAdminSession(),
      loadAdminNavigation(),
    ]);

    session.value = nextSession;
    source.value = navigation.source;
    categories.value = navigation.categories;
    applySelection(selection?.categoryId, selection?.siteId);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "加载管理数据失败。";
  } finally {
    isLoading.value = false;
  }
}

function selectCategory(categoryId: number) {
  if (selectedCategoryId.value === categoryId) {
    return;
  }

  clearFeedback();
  const category = categories.value.find((item) => item.id === categoryId) ?? null;

  selectedCategoryId.value = category?.id ?? null;

  const firstSite = category?.sites[0] ?? null;
  selectedSiteId.value = firstSite?.id ?? null;
}

function selectSite(siteId: number) {
  if (selectedSiteId.value === siteId) {
    return;
  }

  clearFeedback();
  selectedSiteId.value = sitesInSelectedCategory.value.find((item) => item.id === siteId)?.id ?? null;
}

function closeCategoryModal() {
  isCategoryModalOpen.value = false;
}

function closeSiteModal() {
  isSiteModalOpen.value = false;
}

function startCreateCategory() {
  clearFeedback();
  categoryMode.value = "create";
  fillCategoryDraft(null);
  isCategoryModalOpen.value = true;
}

function startEditCategory(categoryId = selectedCategoryId.value) {
  if (!categoryId) {
    return;
  }

  clearFeedback();
  const category = categories.value.find((item) => item.id === categoryId) ?? null;

  if (!category) {
    return;
  }

  selectedCategoryId.value = category.id;
  categoryMode.value = "edit";
  fillCategoryDraft(category);
  isCategoryModalOpen.value = true;
}

function startCreateSite(categoryId = selectedCategoryId.value ?? categories.value[0]?.id ?? 0) {
  if (!categoryId) {
    return;
  }

  clearFeedback();
  siteMode.value = "create";
  fillSiteDraft(null, categoryId);
  isSiteModalOpen.value = true;
}

function startEditSite(siteId = selectedSiteId.value) {
  if (!siteId) {
    return;
  }

  clearFeedback();
  const site = sitesInSelectedCategory.value.find((item) => item.id === siteId) ?? null;

  if (!site) {
    return;
  }

  selectedSiteId.value = site.id;
  siteMode.value = "edit";
  fillSiteDraft(site, site.categoryId);
  isSiteModalOpen.value = true;
}

async function submitCategory() {
  if (categoryFormIssues.value.length) {
    errorMessage.value = categoryFormIssues.value[0] ?? "分类表单不完整。";
    notice.value = "";
    return;
  }

  busyKey.value = "save-category";
  clearFeedback();

  try {
    if (categoryMode.value === "create") {
      const { category } = await createAdminCategory(categoryDraft.value);
      await refreshAdminData({ categoryId: category.id });
      closeCategoryModal();
      notice.value = "分类已创建。";
      return;
    }

    if (!selectedCategory.value) {
      throw new Error("请选择一个分类后再保存。");
    }

    const { category } = await updateAdminCategory(selectedCategory.value.id, categoryDraft.value);
    await refreshAdminData({ categoryId: category.id, siteId: selectedSiteId.value });
    closeCategoryModal();
    notice.value = "分类已更新。";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "分类保存失败。";
  } finally {
    busyKey.value = "";
  }
}

async function submitSite() {
  if (siteFormIssues.value.length) {
    errorMessage.value = siteFormIssues.value[0] ?? "站点表单不完整。";
    notice.value = "";
    return;
  }

  busyKey.value = "save-site";
  clearFeedback();

  try {
    if (siteMode.value === "create") {
      const { site } = await createAdminSite(siteDraft.value);
      await refreshAdminData({ categoryId: site.categoryId, siteId: site.id });
      closeSiteModal();
      notice.value = "站点已创建。";
      return;
    }

    if (!selectedSite.value) {
      throw new Error("请选择一个站点后再保存。");
    }

    const { site } = await updateAdminSite(selectedSite.value.id, siteDraft.value);
    await refreshAdminData({ categoryId: site.categoryId, siteId: site.id });
    closeSiteModal();
    notice.value = "站点已更新。";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "站点保存失败。";
  } finally {
    busyKey.value = "";
  }
}

async function removeCategory(categoryId: number) {
  const category = categories.value.find((item) => item.id === categoryId) ?? null;

  if (!category) {
    return;
  }

  if (!confirmDanger(`删除分类「${category.title}」及其 ${category.sites.length} 个站点？`)) {
    return;
  }

  busyKey.value = "delete-category";
  clearFeedback();

  try {
    const currentIndex = categories.value.findIndex((item) => item.id === categoryId);
    const fallbackCategoryId = categories.value[currentIndex + 1]?.id ?? categories.value[currentIndex - 1]?.id ?? null;

    await deleteAdminCategory(categoryId);
    await refreshAdminData({ categoryId: fallbackCategoryId });
    closeCategoryModal();
    notice.value = "分类已删除。";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "分类删除失败。";
  } finally {
    busyKey.value = "";
  }
}

async function removeSite(siteId: number) {
  const currentSites = sitesInSelectedCategory.value;
  const site = currentSites.find((item) => item.id === siteId) ?? null;

  if (!site) {
    return;
  }

  if (!confirmDanger(`删除站点「${site.title}」？`)) {
    return;
  }

  busyKey.value = "delete-site";
  clearFeedback();

  try {
    const currentIndex = currentSites.findIndex((item) => item.id === siteId);
    const fallbackSiteId = currentSites[currentIndex + 1]?.id ?? currentSites[currentIndex - 1]?.id ?? null;

    await deleteAdminSite(siteId);
    await refreshAdminData({ categoryId: selectedCategoryId.value, siteId: fallbackSiteId });
    closeSiteModal();
    notice.value = "站点已删除。";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "站点删除失败。";
  } finally {
    busyKey.value = "";
  }
}

async function moveCategory(categoryId: number, direction: -1 | 1) {
  const currentIndex = categories.value.findIndex((item) => item.id === categoryId);
  const targetIndex = currentIndex + direction;

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= categories.value.length) {
    return;
  }

  const nextOrder = categories.value.map((item) => item.id);
  [nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]];

  busyKey.value = "reorder-category";
  clearFeedback();

  try {
    await reorderAdminCategories(nextOrder);
    await refreshAdminData({ categoryId });
    notice.value = "分类顺序已更新。";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "分类排序失败。";
  } finally {
    busyKey.value = "";
  }
}

async function moveSite(siteId: number, direction: -1 | 1) {
  const category = selectedCategory.value;

  if (!category) {
    return;
  }

  const currentIndex = category.sites.findIndex((item) => item.id === siteId);
  const targetIndex = currentIndex + direction;

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= category.sites.length) {
    return;
  }

  const nextOrder = category.sites.map((item) => item.id);
  [nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]];

  busyKey.value = "reorder-site";
  clearFeedback();

  try {
    await reorderAdminSites(category.id, nextOrder);
    await refreshAdminData({ categoryId: category.id, siteId });
    notice.value = "站点顺序已更新。";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "站点排序失败。";
  } finally {
    busyKey.value = "";
  }
}

onMounted(() => {
  void refreshAdminData();
});

watch(isAnyModalOpen, (open) => {
  if (typeof document === "undefined") {
    return;
  }

  document.body.classList.toggle("admin-modal-open", open);
});

onUnmounted(() => {
  if (typeof document === "undefined") {
    return;
  }

  document.body.classList.remove("admin-modal-open");
});
</script>

<template>
  <div class="admin-page">
    <main class="admin-layout">
      <header class="admin-dashboard-header admin-panel">
        <div class="admin-dashboard-header__main">
          <div>
            <div class="admin-panel__title">Dashboard</div>
            <h1 class="admin-dashboard-header__title">内容管理</h1>
          </div>
          <div class="admin-dashboard-header__actions">
            <button type="button" class="admin-button" :disabled="isBusy()" @click="refreshAdminData()">
              刷新
            </button>
            <RouterLink to="/" class="admin-hero__link">回到前台</RouterLink>
          </div>
        </div>

        <div class="admin-stats">
          <div class="admin-stat-card">
            <span class="admin-stat-card__label">分类</span>
            <strong>{{ categories.length }}</strong>
          </div>
          <div class="admin-stat-card">
            <span class="admin-stat-card__label">站点</span>
            <strong>{{ totalSites }}</strong>
          </div>
          <div class="admin-stat-card">
            <span class="admin-stat-card__label">当前用户</span>
            <strong>{{ session?.email ?? "加载中" }}</strong>
          </div>
          <div class="admin-stat-card">
            <span class="admin-stat-card__label">状态</span>
            <strong>{{ pageStatus }}</strong>
          </div>
        </div>
      </header>

      <div v-if="notice" class="admin-flash admin-flash--success">{{ notice }}</div>
      <div v-if="errorMessage" class="admin-flash admin-flash--error">{{ errorMessage }}</div>

      <section class="admin-dashboard">
        <section class="admin-section admin-section--categories">
          <div class="admin-section__header">
            <div>
              <h2 class="admin-section__title">分类管理</h2>
              <div class="admin-section__meta">{{ categories.length }} 项</div>
            </div>
            <button type="button" class="admin-button admin-button--primary" :disabled="isBusy()" @click="startCreateCategory">
              新建分类
            </button>
          </div>

          <div class="admin-section__body">
            <div v-if="hasCategories" class="admin-record-list">
              <article
                v-for="(category, categoryIndex) in categories"
                :key="category.id"
                class="admin-record"
                :class="{ 'is-active': category.id === selectedCategoryId }"
              >
                <button type="button" class="admin-record__main" @click="selectCategory(category.id)">
                  <strong>{{ category.title }}</strong>
                  <span>{{ category.sites.length }} 个站点</span>
                </button>
                <div class="admin-record__actions">
                  <button type="button" class="admin-mini-button" :disabled="isBusy() || categoryIndex === 0" @click="moveCategory(category.id, -1)">
                    ↑
                  </button>
                  <button
                    type="button"
                    class="admin-mini-button"
                    :disabled="isBusy() || categoryIndex === categories.length - 1"
                    @click="moveCategory(category.id, 1)"
                  >
                    ↓
                  </button>
                  <button type="button" class="admin-mini-button" :disabled="isBusy()" @click="startEditCategory(category.id)">
                    编辑
                  </button>
                  <button type="button" class="admin-mini-button admin-mini-button--danger" :disabled="isBusy()" @click="removeCategory(category.id)">
                    删除
                  </button>
                </div>
              </article>
            </div>
            <div v-else class="admin-empty">暂无分类</div>
          </div>
        </section>

        <section class="admin-section admin-section--sites">
          <div class="admin-section__header">
            <div>
              <h2 class="admin-section__title">站点管理</h2>
              <div class="admin-section__meta">
                {{ selectedCategory ? `${selectedCategory.title} · ${sitesInSelectedCategory.length} 项` : "请先选择分类" }}
              </div>
            </div>
            <button
              type="button"
              class="admin-button admin-button--primary"
              :disabled="isBusy() || !hasSelectedCategory"
              @click="startCreateSite(selectedCategory?.id)"
            >
              新建站点
            </button>
          </div>

          <div class="admin-section__body">
            <div v-if="sitesInSelectedCategory.length" class="admin-record-list">
              <article
                v-for="(site, siteIndex) in sitesInSelectedCategory"
                :key="site.id"
                class="admin-record admin-record--site"
                :class="{ 'is-active': site.id === selectedSiteId }"
              >
                <button type="button" class="admin-record__main" @click="selectSite(site.id)">
                  <strong>{{ site.title }}</strong>
                  <span>{{ site.displayLink }}</span>
                </button>
                <div class="admin-record__actions">
                  <button type="button" class="admin-mini-button" :disabled="isBusy() || siteIndex === 0" @click="moveSite(site.id, -1)">
                    ↑
                  </button>
                  <button
                    type="button"
                    class="admin-mini-button"
                    :disabled="isBusy() || siteIndex === sitesInSelectedCategory.length - 1"
                    @click="moveSite(site.id, 1)"
                  >
                    ↓
                  </button>
                  <button type="button" class="admin-mini-button" :disabled="isBusy()" @click="startEditSite(site.id)">
                    编辑
                  </button>
                  <button type="button" class="admin-mini-button admin-mini-button--danger" :disabled="isBusy()" @click="removeSite(site.id)">
                    删除
                  </button>
                </div>
              </article>
            </div>
            <div v-else class="admin-empty">
              {{ hasSelectedCategory ? "当前分类暂无站点" : "请选择分类后管理站点" }}
            </div>
          </div>
        </section>
      </section>

      <Teleport to="body">
        <div
          v-if="isCategoryModalOpen"
          class="admin-modal-backdrop"
          @click.stop
          @mousedown.stop
          @mouseup.stop
        >
          <section class="admin-modal" @click.stop @mousedown.stop @mouseup.stop>
            <div class="admin-modal__header">
              <div>
                <div class="admin-panel__title">分类</div>
                <h3>{{ categoryMode === "create" ? "新建分类" : "编辑分类" }}</h3>
              </div>
              <button type="button" class="admin-modal__close" :disabled="isBusy()" @click="closeCategoryModal">
                关闭
              </button>
            </div>

            <div class="admin-form-grid">
              <label class="admin-field">
                <span>名称</span>
                <input v-model="categoryDraft.title" type="text" placeholder="例如：大前端" />
              </label>
              <label class="admin-field">
                <span>图标</span>
                <input v-model="categoryDraft.icon" type="text" placeholder="例如：frontend" />
              </label>
            </div>

            <div class="admin-modal__actions">
              <button type="button" class="admin-button admin-button--primary" :disabled="isBusy() || !!categoryFormIssues.length" @click="submitCategory">
                {{ categoryMode === "create" ? "创建" : "保存" }}
              </button>
              <button type="button" class="admin-button" :disabled="isBusy()" @click="closeCategoryModal">
                取消
              </button>
              <button
                v-if="selectedCategory && categoryMode === 'edit'"
                type="button"
                class="admin-button admin-button--danger"
                :disabled="isBusy()"
                @click="removeCategory(selectedCategory.id)"
              >
                删除
              </button>
            </div>
          </section>
        </div>

        <div
          v-if="isSiteModalOpen"
          class="admin-modal-backdrop"
          @click.stop
          @mousedown.stop
          @mouseup.stop
        >
          <section class="admin-modal admin-modal--wide" @click.stop @mousedown.stop @mouseup.stop>
            <div class="admin-modal__header">
              <div>
                <div class="admin-panel__title">站点</div>
                <h3>{{ siteMode === "create" ? "新建站点" : "编辑站点" }}</h3>
              </div>
              <button type="button" class="admin-modal__close" :disabled="isBusy()" @click="closeSiteModal">
                关闭
              </button>
            </div>

            <div class="admin-form-grid">
              <label class="admin-field">
                <span>所属分类</span>
                <select v-model.number="siteDraft.categoryId" :disabled="isBusy() || !categories.length">
                  <option :value="0" disabled>请选择</option>
                  <option v-for="category in categories" :key="category.id" :value="category.id">
                    {{ category.title }}
                  </option>
                </select>
              </label>
              <label class="admin-field">
                <span>图标</span>
                <input v-model="siteDraft.icon" type="text" placeholder="例如：github.svg" />
              </label>
              <label class="admin-field">
                <span>标题</span>
                <input v-model="siteDraft.title" type="text" />
              </label>
              <label class="admin-field">
                <span>展示链接</span>
                <input v-model="siteDraft.displayLink" type="url" />
              </label>
              <label class="admin-field admin-field--full">
                <span>副标题</span>
                <textarea v-model="siteDraft.subTitle" rows="3"></textarea>
              </label>
              <label class="admin-field admin-field--full">
                <span>跳转 URL</span>
                <input v-model="siteDraft.url" type="url" />
              </label>
            </div>

            <div class="admin-modal__actions">
              <button type="button" class="admin-button admin-button--primary" :disabled="isBusy() || !!siteFormIssues.length" @click="submitSite">
                {{ siteMode === "create" ? "创建" : "保存" }}
              </button>
              <button type="button" class="admin-button" :disabled="isBusy()" @click="closeSiteModal">
                取消
              </button>
              <button
                v-if="selectedSite && siteMode === 'edit'"
                type="button"
                class="admin-button admin-button--danger"
                :disabled="isBusy()"
                @click="removeSite(selectedSite.id)"
              >
                删除
              </button>
            </div>
          </section>
        </div>
      </Teleport>
    </main>
  </div>
</template>
