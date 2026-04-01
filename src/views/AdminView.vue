<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

import type { Category } from "../data/navigation";
import { navigationCategories } from "../data/navigation";
import {
  loadAdminNavigation,
  loadAdminSession,
  saveAdminNavigation,
  stripRuntimeFields,
  type AdminSession,
} from "../services/admin";

const session = ref<AdminSession | null>(null);
const source = ref("loading");
const editorValue = ref("");
const initialValue = ref("");
const isLoading = ref(true);
const isSaving = ref(false);
const notice = ref("");
const errorMessage = ref("");

function isSiteRecord(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.title === "string"
    && typeof record.subTitle === "string"
    && typeof record.displayLink === "string"
    && typeof record.url === "string"
    && typeof record.icon === "string"
  );
}

function isCategoryRecord(value: unknown): value is Category {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.title === "string"
    && typeof record.icon === "string"
    && Array.isArray(record.sites)
    && record.sites.every(isSiteRecord)
  );
}

function stringifyCategories(categories: Category[]): string {
  return JSON.stringify(stripRuntimeFields(categories), null, 2);
}

function parseCategories(value: string): Category[] {
  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed) || !parsed.every(isCategoryRecord)) {
    throw new Error("JSON 结构无效。顶层必须是 Category 数组，且字段必须完整。");
  }

  return parsed;
}

const parsedCategories = computed(() => {
  try {
    return parseCategories(editorValue.value);
  } catch {
    return null;
  }
});

const parseError = computed(() => {
  try {
    parseCategories(editorValue.value);
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : "JSON 解析失败。";
  }
});

const totalSites = computed(() =>
  parsedCategories.value?.reduce((count, category) => count + category.sites.length, 0) ?? 0,
);

const categoryTitles = computed(() =>
  parsedCategories.value?.map((category) => category.title).slice(0, 6) ?? [],
);

const hasUnsavedChanges = computed(() => editorValue.value !== initialValue.value);

async function refreshAdminData() {
  errorMessage.value = "";
  notice.value = "";
  isLoading.value = true;

  try {
    const [nextSession, navigation] = await Promise.all([
      loadAdminSession(),
      loadAdminNavigation(),
    ]);

    session.value = nextSession;
    source.value = navigation.source;
    editorValue.value = stringifyCategories(navigation.categories);
    initialValue.value = editorValue.value;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "加载管理数据失败。";
  } finally {
    isLoading.value = false;
  }
}

function formatEditor() {
  if (!parsedCategories.value) {
    errorMessage.value = parseError.value;
    return;
  }

  editorValue.value = stringifyCategories(parsedCategories.value);
  errorMessage.value = "";
}

function loadBundledSeed() {
  editorValue.value = stringifyCategories(navigationCategories);
  notice.value = "已载入仓库内置导航数据，保存后会覆盖 D1 中的当前内容。";
  errorMessage.value = "";
}

async function saveChanges() {
  if (!parsedCategories.value) {
    errorMessage.value = parseError.value;
    return;
  }

  isSaving.value = true;
  errorMessage.value = "";
  notice.value = "";

  try {
    const payload = await saveAdminNavigation(parsedCategories.value);
    source.value = payload.source;
    editorValue.value = stringifyCategories(payload.categories);
    initialValue.value = editorValue.value;
    notice.value = "已写入 D1，前台 `/api/navigation` 会读取最新版本。";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "保存失败。";
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  void refreshAdminData();
});
</script>

<template>
  <div class="admin-page">
    <main class="admin-layout">
      <header class="admin-hero">
        <div class="admin-hero__eyebrow">Access Protected Admin</div>
        <div class="admin-hero__header">
          <div>
            <h1 class="admin-hero__title">发布内容不再改代码，直接改 D1。</h1>
            <p class="admin-hero__description">
              这个后台面向维护者，依赖 Cloudflare Access 保护 `/admin` 和 `/api/admin/*`，当前编辑的是导航站的单一生产数据集。
            </p>
          </div>
          <RouterLink to="/" class="admin-hero__link">回到前台</RouterLink>
        </div>

        <div class="admin-summary">
          <div class="admin-summary__card">
            <span class="admin-summary__label">当前身份</span>
            <strong>{{ session?.email ?? "加载中" }}</strong>
            <span class="admin-summary__hint">{{ session?.source ?? "等待 Access" }}</span>
          </div>
          <div class="admin-summary__card">
            <span class="admin-summary__label">分类 / 站点</span>
            <strong>{{ parsedCategories?.length ?? 0 }} / {{ totalSites }}</strong>
            <span class="admin-summary__hint">source: {{ source }}</span>
          </div>
          <div class="admin-summary__card">
            <span class="admin-summary__label">状态</span>
            <strong>{{ hasUnsavedChanges ? "有未保存修改" : "已同步" }}</strong>
            <span class="admin-summary__hint">保存会覆盖 D1 中现有内容</span>
          </div>
        </div>
      </header>

      <section class="admin-workbench">
        <aside class="admin-sidebar">
          <div class="admin-panel">
            <div class="admin-panel__title">操作</div>
            <div class="admin-actions">
              <button type="button" class="admin-button admin-button--primary" :disabled="isLoading || isSaving || !!parseError"
                @click="saveChanges">
                {{ isSaving ? "写入中..." : "保存到 D1" }}
              </button>
              <button type="button" class="admin-button" :disabled="isLoading || isSaving" @click="refreshAdminData">
                从 D1 重新加载
              </button>
              <button type="button" class="admin-button" :disabled="isLoading || isSaving" @click="formatEditor">
                格式化 JSON
              </button>
              <button type="button" class="admin-button" :disabled="isLoading || isSaving" @click="loadBundledSeed">
                载入仓库初始数据
              </button>
            </div>
          </div>

          <div class="admin-panel">
            <div class="admin-panel__title">字段约定</div>
            <ul class="admin-notes">
              <li>顶层是 `Category[]` 数组。</li>
              <li>`icon` 写文件名即可，例如 `google.png`。</li>
              <li>保存时会重建 D1 中的分类与站点数据。</li>
              <li>图标访问会走 R2；如果对象缺失，Worker 会尝试从内置资源回填。</li>
            </ul>
          </div>

          <div class="admin-panel">
            <div class="admin-panel__title">快速检查</div>
            <div class="admin-tag-list">
              <span v-for="title in categoryTitles" :key="title" class="admin-tag">{{ title }}</span>
            </div>
            <p v-if="!categoryTitles.length" class="admin-panel__empty">当前内容还没有可预览的分类。</p>
          </div>
        </aside>

        <section class="admin-editor">
          <div class="admin-editor__topbar">
            <div>
              <div class="admin-panel__title">导航 JSON</div>
              <p class="admin-editor__hint">建议先用「格式化 JSON」，再保存。</p>
            </div>
            <div class="admin-editor__status" :class="{ 'is-error': !!parseError }">
              {{ parseError || "JSON 结构有效" }}
            </div>
          </div>

          <div v-if="notice" class="admin-flash admin-flash--success">{{ notice }}</div>
          <div v-if="errorMessage" class="admin-flash admin-flash--error">{{ errorMessage }}</div>

          <textarea
            v-model="editorValue"
            class="admin-editor__textarea"
            spellcheck="false"
            :disabled="isLoading"
            aria-label="导航 JSON 编辑器"
          ></textarea>
        </section>
      </section>
    </main>
  </div>
</template>
