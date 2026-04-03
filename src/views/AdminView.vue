<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { GripVertical, ImagePlus, Link2, Pencil, RefreshCcw, Upload, X } from "lucide-vue-next";
import { RouterLink } from "vue-router";

import { categoryIconOptions, categoryIcons } from "../icons";
import {
  buildAdminIconUrl,
  createAdminCategory,
  createAdminSite,
  createEmptyCategoryInput,
  createEmptySiteInput,
  deleteAdminCategory,
  deleteAdminSite,
  loadAdminNavigation,
  loadAdminSession,
  importAdminSiteLogoUrl,
  normalizeAdminSiteUrl,
  reorderAdminCategories,
  reorderAdminSites,
  resolveAdminSiteMetadata,
  updateAdminCategory,
  updateAdminSite,
  type AdminCategory,
  type AdminSession,
  type AdminSite,
  type CategoryInput,
  type ResolvedSiteMetadata,
  type SiteInput,
  uploadAdminSiteLogoFile,
} from "../services/admin";

type FormMode = "create" | "edit";
type ReorderTarget = "category" | "site";
type DropPosition = "before" | "after";

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
const siteMetadata = ref<ResolvedSiteMetadata | null>(null);
const siteMetadataStatus = ref<"idle" | "loading" | "success" | "error">("idle");
const siteMetadataMessage = ref("");
const siteCustomIconPreviewUrl = ref("");
const isSiteLogoEditorOpen = ref(false);
const siteLogoEditorMode = ref<"upload" | "url">("upload");
const siteRemoteIconUrl = ref("");
const siteLogoStatus = ref<"idle" | "loading" | "success" | "error">("idle");
const siteLogoMessage = ref("");
const dragState = ref<{
  target: ReorderTarget;
  sourceId: number;
  overId: number | null;
  position: DropPosition;
} | null>(null);
const siteAutofillSnapshot = ref({
  title: "",
  subTitle: "",
  displayLink: "",
  icon: "",
});

let siteMetadataTimer: ReturnType<typeof setTimeout> | null = null;
let shouldSkipNextSiteLookup = false;
let lastResolvedSiteUrl = "";

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

  if (!siteDraft.value.url.trim()) {
    issues.push("跳转 URL 不能为空。");
  }

  if (!siteDraft.value.icon.trim()) {
    issues.push("站点图标不能为空。");
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

const hasCategories = computed(() => categories.value.length > 0);
const hasSelectedCategory = computed(() => Boolean(selectedCategory.value));
const isAnyModalOpen = computed(() => isCategoryModalOpen.value || isSiteModalOpen.value);
const isCategoryIconPreset = computed(() =>
  categoryIconOptions.some((option) => option.key === categoryDraft.value.icon),
);
const activeCategoryIconOption = computed(() =>
  categoryIconOptions.find((option) => option.key === categoryDraft.value.icon) ?? null,
);

function isExternalHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

const siteIconPreviewUrl = computed(() => {
  if (siteCustomIconPreviewUrl.value) {
    return siteCustomIconPreviewUrl.value;
  }

  if (siteMetadata.value?.iconUrl && siteMetadata.value.icon === siteDraft.value.icon) {
    return siteMetadata.value.iconUrl;
  }

  if (isExternalHttpUrl(siteDraft.value.icon)) {
    return siteDraft.value.icon;
  }

  return buildAdminIconUrl(siteDraft.value.icon || "default.png");
});
const sitePreviewTitle = computed(() => siteDraft.value.title.trim() || "等待解析站点标题");
const sitePreviewSubTitle = computed(() => siteDraft.value.subTitle.trim() || "输入跳转链接后自动尝试抓取简介，也可以手动补充。");
const sitePreviewDisplayLink = computed(() => siteDraft.value.displayLink.trim() || siteDraft.value.url.trim() || "展示链接默认与跳转链接一致");
const siteMetadataStatusText = computed(() => {
  if (siteMetadataStatus.value === "loading") {
    return "正在解析站点信息和 logo 预览";
  }

  if (siteMetadataStatus.value === "success") {
    return siteMetadataMessage.value || "站点信息已更新";
  }

  if (siteMetadataStatus.value === "error") {
    return siteMetadataMessage.value || "站点信息解析失败";
  }

  return siteMetadataMessage.value || "输入跳转链接后会自动解析标题、简介和图标。";
});

const siteLogoStatusText = computed(() => {
  if (siteLogoStatus.value === "loading") {
    return siteLogoMessage.value || "正在处理 logo…";
  }

  if (siteLogoStatus.value === "success") {
    return siteLogoMessage.value || "Logo 已更新。";
  }

  if (siteLogoStatus.value === "error") {
    return siteLogoMessage.value || "Logo 处理失败。";
  }

  if (siteCustomIconPreviewUrl.value) {
    return "当前使用手动设置的 logo，已保存到 R2。";
  }

  if (siteMetadata.value?.icon === siteDraft.value.icon) {
    return "当前预览来自自动解析结果；点击创建/保存时会写入 R2。";
  }

  return "可上传本地图片，或输入远程图片链接后导入到 R2。";
});

function getCategoryIcon(icon: string) {
  return categoryIcons[icon as keyof typeof categoryIcons] ?? categoryIcons.featured;
}

function getSiteIconUrl(icon: string) {
  return buildAdminIconUrl(icon || "default.png");
}

function selectCategoryIcon(icon: string) {
  categoryDraft.value.icon = icon;
}

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

function resetDragState() {
  dragState.value = null;
}

function resetSiteMetadataState() {
  siteMetadata.value = null;
  siteMetadataStatus.value = "idle";
  siteMetadataMessage.value = "";
  siteCustomIconPreviewUrl.value = "";
  isSiteLogoEditorOpen.value = false;
  siteLogoEditorMode.value = "upload";
  siteRemoteIconUrl.value = "";
  siteLogoStatus.value = "idle";
  siteLogoMessage.value = "";
  siteAutofillSnapshot.value = {
    title: "",
    subTitle: "",
    displayLink: "",
    icon: "",
  };
  lastResolvedSiteUrl = "";
}

function clearPendingSiteMetadataLookup() {
  if (!siteMetadataTimer) {
    return;
  }

  clearTimeout(siteMetadataTimer);
  siteMetadataTimer = null;
}

function shouldApplyAutofill(currentValue: string, previousAutoValue: string): boolean {
  const normalizedCurrent = currentValue.trim();
  const normalizedPrevious = previousAutoValue.trim();

  return !normalizedCurrent || (Boolean(normalizedPrevious) && normalizedCurrent === normalizedPrevious);
}

function shouldApplyResolvedIcon(currentValue: string, previousAutoValue: string): boolean {
  return currentValue.trim() === "default.png" || shouldApplyAutofill(currentValue, previousAutoValue);
}

function normalizeSiteDraftUrl() {
  const normalizedUrl = normalizeAdminSiteUrl(siteDraft.value.url);

  if (!normalizedUrl || normalizedUrl === siteDraft.value.url) {
    return normalizedUrl;
  }

  shouldSkipNextSiteLookup = true;
  siteDraft.value.url = normalizedUrl;
  return normalizedUrl;
}

function createNormalizedSitePayload(input: SiteInput): SiteInput {
  return {
    ...input,
    title: input.title.trim(),
    subTitle: input.subTitle.trim(),
    displayLink: input.displayLink.trim(),
    url: normalizeAdminSiteUrl(input.url),
    icon: input.icon.trim() || "default.png",
  };
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
  shouldSkipNextSiteLookup = true;
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
  resetSiteMetadataState();

  if (site) {
    siteCustomIconPreviewUrl.value = buildAdminIconUrl(site.icon);
    siteLogoStatus.value = "success";
    siteLogoMessage.value = "当前使用已保存的 logo。";
  }
}

function setSiteLogoStatus(status: "idle" | "loading" | "success" | "error", message = "") {
  siteLogoStatus.value = status;
  siteLogoMessage.value = message;
}

function applySiteIcon(icon: string, previewUrl: string, message: string) {
  shouldSkipNextSiteLookup = true;
  siteDraft.value.icon = icon;
  siteCustomIconPreviewUrl.value = previewUrl;
  setSiteLogoStatus("success", message);
}

function toggleSiteLogoEditor() {
  isSiteLogoEditorOpen.value = !isSiteLogoEditorOpen.value;
}

async function handleSiteLogoFileChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];

  if (!file) {
    return;
  }

  busyKey.value = "upload-logo";
  clearFeedback();
  setSiteLogoStatus("loading", `正在上传 ${file.name}…`);

  try {
    const uploadedLogo = await uploadAdminSiteLogoFile(file, siteDraft.value.url);
    applySiteIcon(uploadedLogo.icon, uploadedLogo.iconUrl, "Logo 已上传到 R2。");
  } catch (error) {
    setSiteLogoStatus("error", error instanceof Error ? error.message : "Logo 上传失败。");
  } finally {
    busyKey.value = "";

    if (input) {
      input.value = "";
    }
  }
}

async function submitRemoteSiteLogo() {
  if (!siteRemoteIconUrl.value.trim()) {
    setSiteLogoStatus("error", "请先输入远程图片链接。");
    return;
  }

  busyKey.value = "upload-logo";
  clearFeedback();
  setSiteLogoStatus("loading", "正在导入远程 logo…");

  try {
    const uploadedLogo = await importAdminSiteLogoUrl(siteRemoteIconUrl.value, siteDraft.value.url);
    applySiteIcon(uploadedLogo.icon, uploadedLogo.iconUrl, "远程 logo 已导入并保存到 R2。");
    siteRemoteIconUrl.value = "";
  } catch (error) {
    setSiteLogoStatus("error", error instanceof Error ? error.message : "远程 logo 导入失败。");
  } finally {
    busyKey.value = "";
  }
}

function restoreResolvedSiteLogo() {
  if (!siteMetadata.value) {
    return;
  }

  shouldSkipNextSiteLookup = true;
  siteDraft.value.icon = siteMetadata.value.icon;
  siteCustomIconPreviewUrl.value = "";
  setSiteLogoStatus("success", "已恢复为自动解析的 logo 预览。");
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
  clearPendingSiteMetadataLookup();
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

async function resolveSiteMetadataForUrl(rawUrl = siteDraft.value.url, force = false) {
  const candidateUrl = normalizeAdminSiteUrl(rawUrl);

  if (!candidateUrl) {
    resetSiteMetadataState();
    return;
  }

  if (candidateUrl !== siteDraft.value.url) {
    shouldSkipNextSiteLookup = true;
    siteDraft.value.url = candidateUrl;
  }

  if (!force && candidateUrl === lastResolvedSiteUrl) {
    return;
  }

  siteMetadataStatus.value = "loading";
  siteMetadataMessage.value = "正在抓取站点信息…";

  try {
    const metadata = await resolveAdminSiteMetadata(candidateUrl);
    const previousAutoFill = { ...siteAutofillSnapshot.value };

    siteMetadata.value = metadata;
    siteMetadataStatus.value = "success";
    siteMetadataMessage.value = metadata.resolution === "fallback"
      ? `站点主页返回受限，已回退解析 ${new URL(metadata.resolvedUrl || metadata.url).hostname} 的基础信息和图标，点击创建/保存时才会上传 logo 到 R2`
      : metadata.resolvedUrl && metadata.resolvedUrl !== metadata.url
        ? `已解析并跟随到 ${new URL(metadata.resolvedUrl).hostname}，点击创建/保存时才会上传 logo 到 R2`
        : `已解析 ${new URL(metadata.url).hostname}，点击创建/保存时才会上传 logo 到 R2`;
    lastResolvedSiteUrl = metadata.url;

    shouldSkipNextSiteLookup = true;
    siteDraft.value.url = metadata.url;
    if (metadata.icon && shouldApplyResolvedIcon(siteDraft.value.icon, previousAutoFill.icon)) {
      siteDraft.value.icon = metadata.icon;
      siteCustomIconPreviewUrl.value = "";
    }

    if (metadata.title && shouldApplyAutofill(siteDraft.value.title, previousAutoFill.title)) {
      siteDraft.value.title = metadata.title;
    }

    if (metadata.subTitle && shouldApplyAutofill(siteDraft.value.subTitle, previousAutoFill.subTitle)) {
      siteDraft.value.subTitle = metadata.subTitle;
    }

    if (metadata.displayLink && shouldApplyAutofill(siteDraft.value.displayLink, previousAutoFill.displayLink)) {
      siteDraft.value.displayLink = metadata.displayLink;
    }

    siteAutofillSnapshot.value = {
      title: metadata.title,
      subTitle: metadata.subTitle,
      displayLink: metadata.displayLink,
      icon: metadata.icon,
    };
  } catch (error) {
    siteMetadata.value = null;
    siteMetadataStatus.value = "error";
    siteMetadataMessage.value = error instanceof Error ? error.message : "站点信息解析失败。";
    lastResolvedSiteUrl = "";
  }
}

function scheduleSiteMetadataResolve(rawUrl = siteDraft.value.url) {
  clearPendingSiteMetadataLookup();

  const candidateUrl = rawUrl.trim();

  if (!candidateUrl) {
    resetSiteMetadataState();
    return;
  }

  siteMetadataStatus.value = "idle";
  siteMetadataMessage.value = "链接已更新，稍后自动重新解析。";
  siteMetadataTimer = setTimeout(() => {
    siteMetadataTimer = null;
    void resolveSiteMetadataForUrl(candidateUrl);
  }, 700);
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
  const payload = createNormalizedSitePayload(siteDraft.value);

  try {
    if (siteMode.value === "create") {
      const { site } = await createAdminSite(payload);
      await refreshAdminData({ categoryId: site.categoryId, siteId: site.id });
      closeSiteModal();
      notice.value = "站点已创建。";
      return;
    }

    if (!selectedSite.value) {
      throw new Error("请选择一个站点后再保存。");
    }

    const { site } = await updateAdminSite(selectedSite.value.id, payload);
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

  if (!confirmDanger(`删除站点「${site.title}」？对应 logo 资源也会从 R2 同步清理（若未被其他站点复用）。`)) {
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

function resolveDropPosition(event: DragEvent): DropPosition {
  const currentTarget = event.currentTarget;

  if (!(currentTarget instanceof HTMLElement)) {
    return "after";
  }

  const { top, height } = currentTarget.getBoundingClientRect();
  return event.clientY < top + height / 2 ? "before" : "after";
}

function buildReorderedIds(
  itemIds: number[],
  sourceId: number,
  targetId: number,
  position: DropPosition,
): number[] | null {
  if (sourceId === targetId) {
    return null;
  }

  const sourceIndex = itemIds.indexOf(sourceId);
  const targetIndex = itemIds.indexOf(targetId);

  if (sourceIndex < 0 || targetIndex < 0) {
    return null;
  }

  const nextOrder = itemIds.filter((itemId) => itemId !== sourceId);
  const insertionIndex = nextOrder.indexOf(targetId);

  if (insertionIndex < 0) {
    return null;
  }

  nextOrder.splice(position === "before" ? insertionIndex : insertionIndex + 1, 0, sourceId);

  return nextOrder.every((itemId, index) => itemId === itemIds[index]) ? null : nextOrder;
}

function beginDrag(target: ReorderTarget, sourceId: number, event: DragEvent) {
  if (isBusy()) {
    event.preventDefault();
    return;
  }

  dragState.value = {
    target,
    sourceId,
    overId: null,
    position: "after",
  };

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(sourceId));
  }
}

function updateDragState(target: ReorderTarget, overId: number, event: DragEvent) {
  if (!dragState.value || dragState.value.target !== target) {
    return;
  }

  event.preventDefault();

  dragState.value = {
    ...dragState.value,
    overId,
    position: resolveDropPosition(event),
  };

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

function isDropIndicatorVisible(target: ReorderTarget, itemId: number, position: DropPosition): boolean {
  return dragState.value?.target === target
    && dragState.value.sourceId !== itemId
    && dragState.value.overId === itemId
    && dragState.value.position === position;
}

async function dropCategory(targetId: number) {
  if (!dragState.value || dragState.value.target !== "category") {
    return;
  }

  const nextOrder = buildReorderedIds(
    categories.value.map((category) => category.id),
    dragState.value.sourceId,
    targetId,
    dragState.value.position,
  );

  resetDragState();

  if (!nextOrder) {
    return;
  }

  busyKey.value = "reorder-category";
  clearFeedback();

  try {
    await reorderAdminCategories(nextOrder);
    await refreshAdminData({ categoryId: selectedCategoryId.value ?? targetId, siteId: selectedSiteId.value });
    notice.value = "分类顺序已更新。";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "分类排序失败。";
  } finally {
    busyKey.value = "";
  }
}

async function dropSite(targetId: number) {
  const category = selectedCategory.value;

  if (!category || !dragState.value || dragState.value.target !== "site") {
    return;
  }

  const nextOrder = buildReorderedIds(
    category.sites.map((site) => site.id),
    dragState.value.sourceId,
    targetId,
    dragState.value.position,
  );

  resetDragState();

  if (!nextOrder) {
    return;
  }

  busyKey.value = "reorder-site";
  clearFeedback();

  try {
    await reorderAdminSites(category.id, nextOrder);
    await refreshAdminData({ categoryId: category.id, siteId: selectedSiteId.value ?? targetId });
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

watch(
  () => siteDraft.value.url,
  (nextUrl, previousUrl) => {
    if (!isSiteModalOpen.value || nextUrl === previousUrl) {
      return;
    }

    if (shouldSkipNextSiteLookup) {
      shouldSkipNextSiteLookup = false;
      return;
    }

    scheduleSiteMetadataResolve(nextUrl);
  },
);

onUnmounted(() => {
  if (typeof document === "undefined") {
    return;
  }

  document.body.classList.remove("admin-modal-open");
  clearPendingSiteMetadataLookup();
  resetDragState();
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
        </div>
      </header>

      <div v-if="notice" class="admin-flash admin-flash--success">{{ notice }}</div>
      <div v-if="errorMessage" class="admin-flash admin-flash--error">{{ errorMessage }}</div>

      <section class="admin-dashboard">
        <section class="admin-section admin-section--categories">
          <div class="admin-section__header">
            <div>
              <h2 class="admin-section__title">分类管理</h2>
              <div class="admin-section__meta">{{ categories.length }} 项 · 拖拽卡片即可调整顺序</div>
            </div>
            <button type="button" class="admin-button admin-button--primary" :disabled="isBusy()" @click="startCreateCategory">
              新建分类
            </button>
          </div>

          <div class="admin-section__body">
            <div v-if="hasCategories" class="admin-record-list">
              <article
                v-for="category in categories"
                :key="category.id"
                class="admin-record admin-record--category"
                :class="{
                  'is-active': category.id === selectedCategoryId,
                  'is-dragging': dragState?.target === 'category' && dragState.sourceId === category.id,
                  'is-drop-before': isDropIndicatorVisible('category', category.id, 'before'),
                  'is-drop-after': isDropIndicatorVisible('category', category.id, 'after'),
                }"
                :draggable="!isBusy()"
                @dragstart="beginDrag('category', category.id, $event)"
                @dragover="updateDragState('category', category.id, $event)"
                @drop.prevent="dropCategory(category.id)"
                @dragend="resetDragState"
              >
                <div class="admin-record__handle" aria-hidden="true">
                  <GripVertical :size="18" :stroke-width="2" />
                </div>
                <button type="button" class="admin-record__main" @click="selectCategory(category.id)">
                  <div class="admin-record__thumb admin-record__thumb--category">
                    <component :is="getCategoryIcon(category.icon)" :size="18" :stroke-width="2" />
                  </div>
                  <div class="admin-record__content">
                    <strong>{{ category.title }}</strong>
                    <span>{{ category.sites.length }} 个站点</span>
                  </div>
                </button>
                <div class="admin-record__actions">
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
                {{ selectedCategory ? `${selectedCategory.title} · ${sitesInSelectedCategory.length} 项 · 拖拽卡片即可调整顺序` : "请先选择分类" }}
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
            <div v-if="sitesInSelectedCategory.length" class="admin-record-list admin-record-list--sites">
              <article
                v-for="site in sitesInSelectedCategory"
                :key="site.id"
                class="admin-record admin-record--site"
                :class="{
                  'is-active': site.id === selectedSiteId,
                  'is-dragging': dragState?.target === 'site' && dragState.sourceId === site.id,
                  'is-drop-before': isDropIndicatorVisible('site', site.id, 'before'),
                  'is-drop-after': isDropIndicatorVisible('site', site.id, 'after'),
                }"
                :draggable="!isBusy()"
                @dragstart="beginDrag('site', site.id, $event)"
                @dragover="updateDragState('site', site.id, $event)"
                @drop.prevent="dropSite(site.id)"
                @dragend="resetDragState"
              >
                <div class="admin-record__handle" aria-hidden="true">
                  <GripVertical :size="18" :stroke-width="2" />
                </div>
                <button type="button" class="admin-record__main" @click="selectSite(site.id)">
                  <img
                    :src="getSiteIconUrl(site.icon)"
                    class="admin-record__thumb admin-record__thumb--site"
                    width="52"
                    height="52"
                    :alt="site.title"
                    loading="lazy"
                    decoding="async"
                  />
                  <div class="admin-record__content">
                    <strong>{{ site.title }}</strong>
                    <p class="admin-record__description">{{ site.subTitle }}</p>
                    <span>{{ site.displayLink || site.url }}</span>
                  </div>
                </button>
                <div class="admin-record__actions">
                  <a
                    class="admin-mini-button"
                    :href="site.url"
                    target="_blank"
                    rel="noreferrer noopener"
                    title="打开目标网站"
                  >
                    访问
                  </a>
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
              <div class="admin-field admin-field--full">
                <span>图标</span>
                <div class="admin-category-icon-picker">
                  <div
                    class="admin-category-icon-preview"
                    :class="{ 'is-unlisted': !isCategoryIconPreset }"
                  >
                    <div class="admin-category-icon-preview__swatch">
                      <component :is="getCategoryIcon(categoryDraft.icon)" :size="28" :stroke-width="2.2" />
                    </div>
                    <div class="admin-category-icon-preview__content">
                      <strong>{{ activeCategoryIconOption?.label ?? "当前图标" }}</strong>
                      <span>
                        {{ isCategoryIconPreset ? "已选常用图标，点击下方即可切换。" : "当前图标不在预置列表，建议切换为下方常用图标。" }}
                      </span>
                    </div>
                  </div>

                  <div class="admin-category-icon-grid" role="list" aria-label="分类图标预置">
                    <button
                      v-for="option in categoryIconOptions"
                      :key="option.key"
                      type="button"
                      class="admin-category-icon-option"
                      :class="{ 'is-active': categoryDraft.icon === option.key }"
                      :aria-pressed="categoryDraft.icon === option.key ? 'true' : 'false'"
                      :disabled="isBusy()"
                      @click="selectCategoryIcon(option.key)"
                    >
                      <span class="admin-category-icon-option__glyph">
                        <component :is="getCategoryIcon(option.key)" :size="20" :stroke-width="2.1" />
                      </span>
                      <span class="admin-category-icon-option__label">{{ option.label }}</span>
                    </button>
                  </div>
                </div>
              </div>
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
              <label class="admin-field admin-field--full admin-site-link-field">
                <span>跳转链接</span>
                <div class="admin-site-link-input-row">
                  <input
                    v-model="siteDraft.url"
                    type="text"
                    inputmode="url"
                    autocomplete="off"
                    placeholder="https://example.com"
                    @blur="normalizeSiteDraftUrl"
                  />
                  <button
                    type="button"
                    class="admin-button"
                    :disabled="isBusy() || siteMetadataStatus === 'loading' || !siteDraft.url.trim()"
                    @click="resolveSiteMetadataForUrl(siteDraft.url, true)"
                  >
                    {{ siteMetadataStatus === "loading" ? "解析中" : "重新解析" }}
                  </button>
                </div>
                <small class="admin-field__hint">输入后自动解析标题、简介和图标预览；点击创建/保存时才会把解析出的 logo 上传到 R2。</small>
              </label>

              <div class="admin-site-preview">
                <div class="admin-site-preview__icon">
                  <img :src="siteIconPreviewUrl" :alt="sitePreviewTitle" width="72" height="72" />
                  <button
                    type="button"
                    class="admin-site-preview__edit"
                    :aria-pressed="isSiteLogoEditorOpen ? 'true' : 'false'"
                    :aria-label="isSiteLogoEditorOpen ? '收起 Logo 编辑区域' : '展开 Logo 编辑区域'"
                    :disabled="isBusy()"
                    @click="toggleSiteLogoEditor"
                  >
                    <Pencil :size="16" :stroke-width="2.2" />
                    <span>{{ isSiteLogoEditorOpen ? "收起" : "换 Logo" }}</span>
                  </button>
                </div>
                <div class="admin-site-preview__content">
                  <div class="admin-site-preview__eyebrow">站点卡片预览</div>
                  <strong>{{ sitePreviewTitle }}</strong>
                  <p>{{ sitePreviewSubTitle }}</p>
                  <span>{{ sitePreviewDisplayLink }}</span>
                </div>
              </div>

              <div v-if="isSiteLogoEditorOpen" class="admin-site-logo-editor">
                <div class="admin-site-logo-editor__header">
                  <div class="admin-site-logo-editor__intro">
                    <strong>Logo 编辑区</strong>
                    <span>上传或导入完成后可直接收起，当前预览会保留。</span>
                  </div>
                  <button
                    type="button"
                    class="admin-site-logo-editor__close"
                    :disabled="isBusy()"
                    @click="toggleSiteLogoEditor"
                  >
                    <X :size="15" :stroke-width="2.2" />
                    <span>收起</span>
                  </button>
                </div>
                <div class="admin-site-logo-editor__toolbar">
                  <button
                    type="button"
                    class="admin-site-logo-editor__tab"
                    :class="{ 'is-active': siteLogoEditorMode === 'upload' }"
                    :disabled="isBusy()"
                    @click="siteLogoEditorMode = 'upload'"
                  >
                    <Upload :size="15" :stroke-width="2.1" />
                    <span>本地上传</span>
                  </button>
                  <button
                    type="button"
                    class="admin-site-logo-editor__tab"
                    :class="{ 'is-active': siteLogoEditorMode === 'url' }"
                    :disabled="isBusy()"
                    @click="siteLogoEditorMode = 'url'"
                  >
                    <Link2 :size="15" :stroke-width="2.1" />
                    <span>远程链接</span>
                  </button>
                  <button
                    v-if="siteMetadata"
                    type="button"
                    class="admin-site-logo-editor__ghost"
                    :disabled="isBusy()"
                    @click="restoreResolvedSiteLogo"
                  >
                    <RefreshCcw :size="15" :stroke-width="2.1" />
                    <span>恢复解析</span>
                  </button>
                </div>

                <div v-if="siteLogoEditorMode === 'upload'" class="admin-site-logo-editor__panel">
                  <label class="admin-site-logo-uploader">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,image/avif,image/gif"
                      :disabled="isBusy()"
                      @change="handleSiteLogoFileChange"
                    />
                    <span class="admin-site-logo-uploader__icon">
                      <ImagePlus :size="18" :stroke-width="2" />
                    </span>
                    <span class="admin-site-logo-uploader__copy">
                      <strong>选择本地图片</strong>
                      <small>支持 PNG、JPG、WEBP、SVG、ICO、AVIF、GIF，上传后立即保存到 R2。</small>
                    </span>
                  </label>
                </div>

                <div v-else class="admin-site-logo-editor__panel admin-site-logo-editor__panel--url">
                  <label class="admin-field admin-field--full">
                    <span>远程图片链接</span>
                    <div class="admin-site-link-input-row">
                      <input
                        v-model="siteRemoteIconUrl"
                        type="text"
                        inputmode="url"
                        autocomplete="off"
                        placeholder="https://example.com/logo.png"
                      />
                      <button
                        type="button"
                        class="admin-button"
                        :disabled="isBusy() || !siteRemoteIconUrl.trim()"
                        @click="submitRemoteSiteLogo"
                      >
                        导入
                      </button>
                    </div>
                  </label>
                </div>

                <div
                  class="admin-site-logo-editor__status"
                  :class="{
                    'is-loading': siteLogoStatus === 'loading',
                    'is-error': siteLogoStatus === 'error',
                  }"
                >
                  {{ siteLogoStatusText }}
                </div>
              </div>

              <div
                class="admin-site-lookup-status"
                :class="{
                  'is-loading': siteMetadataStatus === 'loading',
                  'is-error': siteMetadataStatus === 'error',
                }"
              >
                {{ siteMetadataStatusText }}
              </div>

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
                <span>标题</span>
                <input v-model="siteDraft.title" type="text" />
              </label>
              <label class="admin-field">
                <span>展示链接（选填）</span>
                <input
                  v-model="siteDraft.displayLink"
                  type="text"
                  inputmode="url"
                  placeholder="留空则默认与跳转链接一致"
                />
              </label>
              <label class="admin-field admin-field--full">
                <span>副标题</span>
                <textarea v-model="siteDraft.subTitle" rows="3"></textarea>
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
