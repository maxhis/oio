import { navigationCategories, type Category } from "../src/data/navigation";

interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = unknown>(columnName?: string): Promise<T | null>;
}

interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch<T = unknown>(statements: D1PreparedStatementLike[]): Promise<T[]>;
}

interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

interface R2ObjectBodyLike {
  body: ReadableStream | null;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}

interface R2BucketLike {
  get(key: string): Promise<R2ObjectBodyLike | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: {
      httpMetadata?: {
        contentType?: string;
        cacheControl?: string;
      };
    },
  ): Promise<unknown>;
}

interface Env {
  ASSETS: AssetFetcher;
  DB: D1DatabaseLike;
  LOGOS: R2BucketLike;
  ADMIN_DEV_USER_EMAIL?: string;
}

interface CategoryRow {
  id: number;
  title: string;
  icon: string;
  sort_order: number;
}

interface SiteRow {
  id: number;
  category_id: number;
  title: string;
  sub_title: string;
  display_link: string;
  url: string;
  icon_key: string;
  sort_order: number;
}

interface AdminCategoryRecord {
  id: number;
  title: string;
  icon: string;
  sortOrder: number;
  sites: AdminSiteRecord[];
}

interface AdminSiteRecord {
  id: number;
  categoryId: number;
  title: string;
  subTitle: string;
  displayLink: string;
  url: string;
  icon: string;
  sortOrder: number;
}

interface AdminIdentity {
  email: string;
  source: "cloudflare-access" | "local-dev";
}

const LONG_CACHE_CONTROL = "public, max-age=31536000, immutable";
const NAVIGATION_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600";

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init?.headers,
    },
  });
}

function badRequest(message: string): Response {
  return json({ error: message }, { status: 400 });
}

function unauthorizedJson(): Response {
  return json(
    {
      error: "Cloudflare Access authentication required for this route.",
    },
    { status: 401 },
  );
}

function buildLogoObjectKey(icon: string): string {
  return icon.startsWith("logos/") ? icon : `logos/${icon}`;
}

function toClientIconValue(iconKey: string): string {
  return iconKey.startsWith("logos/") ? iconKey.slice("logos/".length) : iconKey;
}

function buildApiIconUrl(icon: string): string {
  return `/api/assets/${buildLogoObjectKey(icon)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function stripRuntimeFields(categories: Category[]): Category[] {
  return categories.map((category) => ({
    title: category.title,
    icon: category.icon,
    sites: category.sites.map((site) => ({
      title: site.title,
      subTitle: site.subTitle,
      displayLink: site.displayLink,
      url: site.url,
      icon: site.icon,
    })),
  }));
}

function mapStaticCategoriesToApiPayload(categories: Category[]): Category[] {
  return categories.map((category) => ({
    ...category,
    sites: category.sites.map((site) => ({
      ...site,
      iconUrl: buildApiIconUrl(site.icon),
    })),
  }));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeCategoryFields(value: unknown): { title: string; icon: string } {
  if (!isRecord(value)) {
    throw new Error("Category payload must be an object.");
  }

  const title = typeof value.title === "string" ? value.title.trim() : "";
  const icon = typeof value.icon === "string" ? value.icon.trim() : "";

  if (!title) {
    throw new Error("Category title is required.");
  }

  if (!icon) {
    throw new Error("Category icon is required.");
  }

  return {
    title,
    icon,
  };
}

function normalizeSiteFields(
  value: unknown,
): { categoryId: number; title: string; subTitle: string; displayLink: string; url: string; icon: string } {
  if (!isRecord(value)) {
    throw new Error("Site payload must be an object.");
  }

  const categoryId = typeof value.categoryId === "number" && Number.isInteger(value.categoryId)
    ? value.categoryId
    : Number.NaN;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const subTitle = typeof value.subTitle === "string" ? value.subTitle.trim() : "";
  const displayLink = typeof value.displayLink === "string" ? value.displayLink.trim() : "";
  const url = typeof value.url === "string" ? value.url.trim() : "";
  const icon = typeof value.icon === "string" ? value.icon.trim() : "";

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new Error("Site categoryId is required.");
  }

  if (!title || !subTitle || !displayLink || !url || !icon) {
    throw new Error("Site title, subTitle, displayLink, url and icon are required.");
  }

  return {
    categoryId,
    title,
    subTitle,
    displayLink,
    url,
    icon,
  };
}

function mapSiteRowToAdminRecord(site: SiteRow): AdminSiteRecord {
  return {
    id: site.id,
    categoryId: site.category_id,
    title: site.title,
    subTitle: site.sub_title,
    displayLink: site.display_link,
    url: site.url,
    icon: toClientIconValue(site.icon_key),
    sortOrder: site.sort_order,
  };
}

function mapAdminRecordsToPublicNavigation(categories: AdminCategoryRecord[]): Category[] {
  return categories.map((category) => ({
    title: category.title,
    icon: category.icon,
    sites: category.sites.map((site) => ({
      title: site.title,
      subTitle: site.subTitle,
      displayLink: site.displayLink,
      url: site.url,
      icon: site.icon,
      iconUrl: buildApiIconUrl(site.icon),
    })),
  }));
}

function normalizeCategoriesInput(value: unknown): Category[] {
  if (!Array.isArray(value)) {
    throw new Error("`categories` must be an array.");
  }

  const categoryTitles = new Set<string>();

  return value.map((categoryValue, categoryIndex) => {
    if (!categoryValue || typeof categoryValue !== "object") {
      throw new Error(`Category ${categoryIndex + 1} is invalid.`);
    }

    const categoryRecord = categoryValue as Record<string, unknown>;
    const title = typeof categoryRecord.title === "string" ? categoryRecord.title.trim() : "";
    const icon = typeof categoryRecord.icon === "string" ? categoryRecord.icon.trim() : "";

    if (!title) {
      throw new Error(`Category ${categoryIndex + 1} is missing a title.`);
    }

    if (!icon) {
      throw new Error(`Category ${title} is missing an icon.`);
    }

    if (categoryTitles.has(title)) {
      throw new Error(`Duplicate category title: ${title}`);
    }

    categoryTitles.add(title);

    if (!Array.isArray(categoryRecord.sites)) {
      throw new Error(`Category ${title} must contain a sites array.`);
    }

    const siteTitles = new Set<string>();
    const siteUrls = new Set<string>();
    const sites = categoryRecord.sites.map((siteValue, siteIndex) => {
      if (!siteValue || typeof siteValue !== "object") {
        throw new Error(`Site ${siteIndex + 1} in ${title} is invalid.`);
      }

      const siteRecord = siteValue as Record<string, unknown>;
      const siteTitle = typeof siteRecord.title === "string" ? siteRecord.title.trim() : "";
      const subTitle = typeof siteRecord.subTitle === "string" ? siteRecord.subTitle.trim() : "";
      const displayLink = typeof siteRecord.displayLink === "string"
        ? siteRecord.displayLink.trim()
        : "";
      const url = typeof siteRecord.url === "string" ? siteRecord.url.trim() : "";
      const siteIcon = typeof siteRecord.icon === "string" ? siteRecord.icon.trim() : "";

      if (!siteTitle || !subTitle || !displayLink || !url || !siteIcon) {
        throw new Error(`Site ${siteIndex + 1} in ${title} is missing required fields.`);
      }

      if (siteTitles.has(siteTitle)) {
        throw new Error(`Duplicate site title "${siteTitle}" in ${title}.`);
      }

      if (siteUrls.has(url)) {
        throw new Error(`Duplicate site url "${url}" in ${title}.`);
      }

      siteTitles.add(siteTitle);
      siteUrls.add(url);

      return {
        title: siteTitle,
        subTitle,
        displayLink,
        url,
        icon: siteIcon,
      };
    });

    return {
      title,
      icon,
      sites,
    };
  });
}

async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
}

function getAdminIdentity(request: Request, env: Env): AdminIdentity | null {
  const accessEmail = request.headers.get("cf-access-authenticated-user-email");

  if (isNonEmptyString(accessEmail)) {
    return {
      email: accessEmail.trim(),
      source: "cloudflare-access",
    };
  }

  const hostname = new URL(request.url).hostname;

  if (
    env.ADMIN_DEV_USER_EMAIL
    && (hostname === "127.0.0.1" || hostname === "localhost")
  ) {
    return {
      email: env.ADMIN_DEV_USER_EMAIL,
      source: "local-dev",
    };
  }

  return null;
}

function isAdminAppPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

async function seedNavigationIfEmpty(env: Env): Promise<boolean> {
  const categoryCount = await env.DB
    .prepare("SELECT COUNT(*) AS count FROM categories")
    .first<number>("count");

  if ((categoryCount ?? 0) > 0) {
    return false;
  }

  const categoryStatements = navigationCategories.map((category, index) =>
    env.DB
      .prepare("INSERT OR IGNORE INTO categories (title, icon, sort_order) VALUES (?, ?, ?)")
      .bind(category.title, category.icon, index),
  );

  if (categoryStatements.length > 0) {
    await env.DB.batch(categoryStatements);
  }

  const { results: categoryRows } = await env.DB
    .prepare("SELECT id, title FROM categories")
    .all<{ id: number; title: string }>();

  const categoryIdMap = new Map(categoryRows.map((row) => [row.title, row.id]));
  const siteStatements: D1PreparedStatementLike[] = [];

  navigationCategories.forEach((category) => {
    const categoryId = categoryIdMap.get(category.title);

    if (!categoryId) {
      return;
    }

    category.sites.forEach((site, siteIndex) => {
      siteStatements.push(
        env.DB
          .prepare(
            [
              "INSERT OR IGNORE INTO sites",
              "(category_id, title, sub_title, display_link, url, icon_key, sort_order)",
              "VALUES (?, ?, ?, ?, ?, ?, ?)",
            ].join(" "),
          )
          .bind(
            categoryId,
            site.title,
            site.subTitle,
            site.displayLink,
            site.url,
            buildLogoObjectKey(site.icon),
            siteIndex,
          ),
      );
    });
  });

  if (siteStatements.length > 0) {
    await env.DB.batch(siteStatements);
  }

  return true;
}

async function readCategoryRows(env: Env): Promise<CategoryRow[]> {
  const { results } = await env.DB
    .prepare("SELECT id, title, icon, sort_order FROM categories ORDER BY sort_order ASC, id ASC")
    .all<CategoryRow>();

  return results;
}

async function readSiteRows(env: Env): Promise<SiteRow[]> {
  const { results } = await env.DB
    .prepare(
      [
        "SELECT id, category_id, title, sub_title, display_link, url, icon_key, sort_order",
        "FROM sites",
        "ORDER BY category_id ASC, sort_order ASC, id ASC",
      ].join(" "),
    )
    .all<SiteRow>();

  return results;
}

async function readAdminNavigationFromD1(env: Env): Promise<AdminCategoryRecord[]> {
  const categories = await readCategoryRows(env);

  if (categories.length === 0) {
    return [];
  }

  const sites = await readSiteRows(env);
  const sitesByCategoryId = new Map<number, AdminSiteRecord[]>();

  sites.forEach((site) => {
    const nextSites = sitesByCategoryId.get(site.category_id) ?? [];
    nextSites.push(mapSiteRowToAdminRecord(site));
    sitesByCategoryId.set(site.category_id, nextSites);
  });

  return categories.map((category) => ({
    id: category.id,
    title: category.title,
    icon: category.icon,
    sortOrder: category.sort_order,
    sites: sitesByCategoryId.get(category.id) ?? [],
  }));
}

async function readNavigationFromD1(env: Env): Promise<Category[]> {
  return mapAdminRecordsToPublicNavigation(await readAdminNavigationFromD1(env));
}

async function readCategoryRowById(env: Env, categoryId: number): Promise<CategoryRow | null> {
  const row = await env.DB
    .prepare("SELECT id, title, icon, sort_order FROM categories WHERE id = ?")
    .bind(categoryId)
    .first<CategoryRow>();

  return row ?? null;
}

async function readSiteRowById(env: Env, siteId: number): Promise<SiteRow | null> {
  const row = await env.DB
    .prepare(
      [
        "SELECT id, category_id, title, sub_title, display_link, url, icon_key, sort_order",
        "FROM sites WHERE id = ?",
      ].join(" "),
    )
    .bind(siteId)
    .first<SiteRow>();

  return row ?? null;
}

async function requireCategoryRowById(env: Env, categoryId: number): Promise<CategoryRow> {
  const row = await readCategoryRowById(env, categoryId);

  if (!row) {
    throw new Error(`Category ${categoryId} not found.`);
  }

  return row;
}

async function requireSiteRowById(env: Env, siteId: number): Promise<SiteRow> {
  const row = await readSiteRowById(env, siteId);

  if (!row) {
    throw new Error(`Site ${siteId} not found.`);
  }

  return row;
}

async function ensureCategoryTitleAvailable(env: Env, title: string, excludeId?: number): Promise<void> {
  const existing = excludeId
    ? await env.DB
      .prepare("SELECT id FROM categories WHERE title = ? AND id != ?")
      .bind(title, excludeId)
      .first<number>("id")
    : await env.DB
      .prepare("SELECT id FROM categories WHERE title = ?")
      .bind(title)
      .first<number>("id");

  if (existing) {
    throw new Error(`Category title "${title}" already exists.`);
  }
}

async function ensureSiteFieldsAvailable(
  env: Env,
  categoryId: number,
  title: string,
  url: string,
  excludeId?: number,
): Promise<void> {
  const duplicateTitle = excludeId
    ? await env.DB
      .prepare("SELECT id FROM sites WHERE category_id = ? AND title = ? AND id != ?")
      .bind(categoryId, title, excludeId)
      .first<number>("id")
    : await env.DB
      .prepare("SELECT id FROM sites WHERE category_id = ? AND title = ?")
      .bind(categoryId, title)
      .first<number>("id");

  if (duplicateTitle) {
    throw new Error(`Site title "${title}" already exists in this category.`);
  }

  const duplicateUrl = excludeId
    ? await env.DB
      .prepare("SELECT id FROM sites WHERE category_id = ? AND url = ? AND id != ?")
      .bind(categoryId, url, excludeId)
      .first<number>("id")
    : await env.DB
      .prepare("SELECT id FROM sites WHERE category_id = ? AND url = ?")
      .bind(categoryId, url)
      .first<number>("id");

  if (duplicateUrl) {
    throw new Error(`Site URL "${url}" already exists in this category.`);
  }
}

async function createCategoryInD1(env: Env, fields: { title: string; icon: string }): Promise<CategoryRow> {
  await ensureCategoryTitleAvailable(env, fields.title);

  const nextSortOrder = await env.DB
    .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextSortOrder FROM categories")
    .first<number>("nextSortOrder");

  await env.DB
    .prepare("INSERT INTO categories (title, icon, sort_order) VALUES (?, ?, ?)")
    .bind(fields.title, fields.icon, nextSortOrder ?? 0)
    .all();

  return requireCategoryRowById(
    env,
    await env.DB
      .prepare("SELECT id FROM categories WHERE title = ?")
      .bind(fields.title)
      .first<number>("id") as number,
  );
}

async function updateCategoryInD1(
  env: Env,
  categoryId: number,
  fields: { title: string; icon: string },
): Promise<CategoryRow> {
  await requireCategoryRowById(env, categoryId);
  await ensureCategoryTitleAvailable(env, fields.title, categoryId);

  await env.DB
    .prepare(
      [
        "UPDATE categories",
        "SET title = ?, icon = ?, updated_at = CURRENT_TIMESTAMP",
        "WHERE id = ?",
      ].join(" "),
    )
    .bind(fields.title, fields.icon, categoryId)
    .all();

  return requireCategoryRowById(env, categoryId);
}

async function deleteCategoryInD1(env: Env, categoryId: number): Promise<void> {
  await requireCategoryRowById(env, categoryId);
  await env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(categoryId).all();
}

async function reorderCategoriesInD1(env: Env, categoryIds: number[]): Promise<void> {
  const categoryRows = await readCategoryRows(env);
  const existingIds = categoryRows.map((row) => row.id);

  if (existingIds.length !== categoryIds.length) {
    throw new Error("Category reorder payload must include every category exactly once.");
  }

  const existingIdSet = new Set(existingIds);

  if (new Set(categoryIds).size !== categoryIds.length || categoryIds.some((id) => !existingIdSet.has(id))) {
    throw new Error("Category reorder payload is invalid.");
  }

  await env.DB.batch(
    categoryIds.map((categoryId, index) =>
      env.DB
        .prepare("UPDATE categories SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(index, categoryId),
    ),
  );
}

async function createSiteInD1(
  env: Env,
  fields: { categoryId: number; title: string; subTitle: string; displayLink: string; url: string; icon: string },
): Promise<SiteRow> {
  await requireCategoryRowById(env, fields.categoryId);
  await ensureSiteFieldsAvailable(env, fields.categoryId, fields.title, fields.url);

  const nextSortOrder = await env.DB
    .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextSortOrder FROM sites WHERE category_id = ?")
    .bind(fields.categoryId)
    .first<number>("nextSortOrder");

  await env.DB
    .prepare(
      [
        "INSERT INTO sites",
        "(category_id, title, sub_title, display_link, url, icon_key, sort_order)",
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
      ].join(" "),
    )
    .bind(
      fields.categoryId,
      fields.title,
      fields.subTitle,
      fields.displayLink,
      fields.url,
      buildLogoObjectKey(fields.icon),
      nextSortOrder ?? 0,
    )
    .all();

  const insertedId = await env.DB
    .prepare("SELECT id FROM sites WHERE category_id = ? AND title = ?")
    .bind(fields.categoryId, fields.title)
    .first<number>("id");

  return requireSiteRowById(env, insertedId as number);
}

async function updateSiteInD1(
  env: Env,
  siteId: number,
  fields: { categoryId: number; title: string; subTitle: string; displayLink: string; url: string; icon: string },
): Promise<SiteRow> {
  const currentSite = await requireSiteRowById(env, siteId);
  await requireCategoryRowById(env, fields.categoryId);
  await ensureSiteFieldsAvailable(env, fields.categoryId, fields.title, fields.url, siteId);

  const nextSortOrder = currentSite.category_id === fields.categoryId
    ? currentSite.sort_order
    : await env.DB
      .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextSortOrder FROM sites WHERE category_id = ?")
      .bind(fields.categoryId)
      .first<number>("nextSortOrder") ?? 0;

  await env.DB
    .prepare(
      [
        "UPDATE sites",
        "SET category_id = ?, title = ?, sub_title = ?, display_link = ?, url = ?, icon_key = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP",
        "WHERE id = ?",
      ].join(" "),
    )
    .bind(
      fields.categoryId,
      fields.title,
      fields.subTitle,
      fields.displayLink,
      fields.url,
      buildLogoObjectKey(fields.icon),
      nextSortOrder,
      siteId,
    )
    .all();

  return requireSiteRowById(env, siteId);
}

async function deleteSiteInD1(env: Env, siteId: number): Promise<void> {
  await requireSiteRowById(env, siteId);
  await env.DB.prepare("DELETE FROM sites WHERE id = ?").bind(siteId).all();
}

async function reorderSitesInD1(env: Env, categoryId: number, siteIds: number[]): Promise<void> {
  await requireCategoryRowById(env, categoryId);

  const { results: siteRows } = await env.DB
    .prepare("SELECT id FROM sites WHERE category_id = ? ORDER BY sort_order ASC, id ASC")
    .bind(categoryId)
    .all<{ id: number }>();

  const existingIds = siteRows.map((row) => row.id);

  if (existingIds.length !== siteIds.length) {
    throw new Error("Site reorder payload must include every site in the category exactly once.");
  }

  const existingIdSet = new Set(existingIds);

  if (new Set(siteIds).size !== siteIds.length || siteIds.some((id) => !existingIdSet.has(id))) {
    throw new Error("Site reorder payload is invalid.");
  }

  await env.DB.batch(
    siteIds.map((siteId, index) =>
      env.DB
        .prepare("UPDATE sites SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(index, siteId),
    ),
  );
}

async function replaceNavigationInD1(env: Env, categories: Category[]): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sites"),
    env.DB.prepare("DELETE FROM categories"),
  ]);

  if (categories.length === 0) {
    return;
  }

  const categoryStatements = categories.map((category, index) =>
    env.DB
      .prepare("INSERT INTO categories (title, icon, sort_order) VALUES (?, ?, ?)")
      .bind(category.title, category.icon, index),
  );

  await env.DB.batch(categoryStatements);

  const { results: categoryRows } = await env.DB
    .prepare("SELECT id, title FROM categories ORDER BY sort_order ASC, id ASC")
    .all<{ id: number; title: string }>();

  const categoryIdMap = new Map(categoryRows.map((row) => [row.title, row.id]));
  const siteStatements: D1PreparedStatementLike[] = [];

  categories.forEach((category) => {
    const categoryId = categoryIdMap.get(category.title);

    if (!categoryId) {
      throw new Error(`Failed to resolve inserted category: ${category.title}`);
    }

    category.sites.forEach((site, siteIndex) => {
      siteStatements.push(
        env.DB
          .prepare(
            [
              "INSERT INTO sites",
              "(category_id, title, sub_title, display_link, url, icon_key, sort_order)",
              "VALUES (?, ?, ?, ?, ?, ?, ?)",
            ].join(" "),
          )
          .bind(
            categoryId,
            site.title,
            site.subTitle,
            site.displayLink,
            site.url,
            buildLogoObjectKey(site.icon),
            siteIndex,
          ),
      );
    });
  });

  if (siteStatements.length > 0) {
    await env.DB.batch(siteStatements);
  }
}

function guessContentType(key: string): string {
  if (key.endsWith(".svg")) {
    return "image/svg+xml";
  }

  if (key.endsWith(".png")) {
    return "image/png";
  }

  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (key.endsWith(".webp")) {
    return "image/webp";
  }

  if (key.endsWith(".ico")) {
    return "image/x-icon";
  }

  return "application/octet-stream";
}

async function warmLogoFromBundledAssets(request: Request, env: Env, key: string): Promise<Response | null> {
  if (!key.startsWith("logos/")) {
    return null;
  }

  const assetUrl = new URL(`/assets/images/${key}`, request.url);
  const assetResponse = await env.ASSETS.fetch(new Request(assetUrl.toString()));

  if (!assetResponse.ok) {
    return null;
  }

  const body = await assetResponse.arrayBuffer();
  const contentType = assetResponse.headers.get("content-type") ?? guessContentType(key);

  await env.LOGOS.put(key, body, {
    httpMetadata: {
      contentType,
      cacheControl: LONG_CACHE_CONTROL,
    },
  });

  return new Response(body, {
    headers: {
      "cache-control": LONG_CACHE_CONTROL,
      "content-type": contentType,
    },
  });
}

async function handleNavigationRequest(env: Env): Promise<Response> {
  try {
    const bootstrapped = await seedNavigationIfEmpty(env);
    const categories = await readNavigationFromD1(env);

    return json(
      {
        categories,
        source: bootstrapped ? "bootstrap" : "d1",
      },
      {
        headers: {
          "cache-control": NAVIGATION_CACHE_CONTROL,
        },
      },
    );
  } catch (error) {
    console.error("Failed to load navigation from D1.", error);

    return json(
      {
        categories: mapStaticCategoriesToApiPayload(navigationCategories),
        source: "fallback",
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }
}

async function handleAdminSessionRequest(request: Request, env: Env): Promise<Response> {
  const identity = getAdminIdentity(request, env);

  if (!identity) {
    return unauthorizedJson();
  }

  return json(identity, {
    headers: {
      "cache-control": "private, no-store",
    },
  });
}

async function handleAdminNavigationRequest(request: Request, env: Env): Promise<Response> {
  const identity = getAdminIdentity(request, env);

  if (!identity) {
    return unauthorizedJson();
  }

  if (request.method === "GET") {
    await seedNavigationIfEmpty(env);
    const categories = await readAdminNavigationFromD1(env);

    return json(
      {
        categories,
        source: "d1",
        editor: identity.email,
      },
      {
        headers: {
          "cache-control": "private, no-store",
        },
      },
    );
  }

  if (request.method === "PUT") {
    try {
      const body = await parseJsonBody(request);
      const categoriesValue = (body as { categories?: unknown }).categories;
      const normalizedCategories = normalizeCategoriesInput(categoriesValue);
      await replaceNavigationInD1(env, normalizedCategories);

      return json(
        {
          categories: await readAdminNavigationFromD1(env),
          source: "d1",
          editor: identity.email,
        },
        {
          headers: {
            "cache-control": "private, no-store",
          },
        },
      );
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : "Invalid navigation payload.");
    }
  }

  return new Response("Method Not Allowed", {
    status: 405,
    headers: {
      Allow: "GET, PUT",
    },
  });
}

async function handleAdminCategoriesRequest(request: Request, env: Env): Promise<Response> {
  const identity = getAdminIdentity(request, env);

  if (!identity) {
    return unauthorizedJson();
  }

  await seedNavigationIfEmpty(env);

  if (request.method === "GET") {
    return json(
      {
        categories: await readAdminNavigationFromD1(env),
        editor: identity.email,
      },
      {
        headers: {
          "cache-control": "private, no-store",
        },
      },
    );
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "GET, POST",
      },
    });
  }

  try {
    const body = await parseJsonBody(request);
    const category = await createCategoryInD1(env, normalizeCategoryFields(body));

    return json(
      {
        category: {
          id: category.id,
          title: category.title,
          icon: category.icon,
          sortOrder: category.sort_order,
          sites: [],
        },
        editor: identity.email,
      },
      {
        status: 201,
        headers: {
          "cache-control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Failed to create category.");
  }
}

async function handleAdminCategoryDetailRequest(
  request: Request,
  env: Env,
  categoryId: number,
): Promise<Response> {
  const identity = getAdminIdentity(request, env);

  if (!identity) {
    return unauthorizedJson();
  }

  await seedNavigationIfEmpty(env);

  if (request.method === "PATCH") {
    try {
      const body = await parseJsonBody(request);
      const category = await updateCategoryInD1(env, categoryId, normalizeCategoryFields(body));

      return json(
        {
          category: {
            id: category.id,
            title: category.title,
            icon: category.icon,
            sortOrder: category.sort_order,
            sites: [],
          },
          editor: identity.email,
        },
        {
          headers: {
            "cache-control": "private, no-store",
          },
        },
      );
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : "Failed to update category.");
    }
  }

  if (request.method === "DELETE") {
    try {
      await deleteCategoryInD1(env, categoryId);

      return json(
        {
          deletedId: categoryId,
          editor: identity.email,
        },
        {
          headers: {
            "cache-control": "private, no-store",
          },
        },
      );
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : "Failed to delete category.");
    }
  }

  return new Response("Method Not Allowed", {
    status: 405,
    headers: {
      Allow: "PATCH, DELETE",
    },
  });
}

async function handleAdminCategoryReorderRequest(request: Request, env: Env): Promise<Response> {
  const identity = getAdminIdentity(request, env);

  if (!identity) {
    return unauthorizedJson();
  }

  await seedNavigationIfEmpty(env);

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "POST",
      },
    });
  }

  try {
    const body = await parseJsonBody(request);
    const categoryIds = Array.isArray((body as { categoryIds?: unknown }).categoryIds)
      ? (body as { categoryIds: unknown[] }).categoryIds.map((value) =>
        typeof value === "number" && Number.isInteger(value) ? value : Number.NaN)
      : [];

    if (!categoryIds.length || categoryIds.some((value) => !Number.isInteger(value) || value <= 0)) {
      throw new Error("`categoryIds` must be an array of positive integers.");
    }

    await reorderCategoriesInD1(env, categoryIds);

    return json(
      {
        categoryIds,
        editor: identity.email,
      },
      {
        headers: {
          "cache-control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Failed to reorder categories.");
  }
}

async function handleAdminSitesRequest(request: Request, env: Env): Promise<Response> {
  const identity = getAdminIdentity(request, env);

  if (!identity) {
    return unauthorizedJson();
  }

  await seedNavigationIfEmpty(env);

  if (request.method === "GET") {
    try {
      const categoryIdParam = new URL(request.url).searchParams.get("categoryId");
      const categoriesPayload = await readAdminNavigationFromD1(env);
      const sites = categoryIdParam
        ? categoriesPayload.find((category) => category.id === parsePositiveInteger(categoryIdParam, "categoryId"))?.sites ?? []
        : categoriesPayload.flatMap((category) => category.sites);

      return json(
        {
          sites,
          editor: identity.email,
        },
        {
          headers: {
            "cache-control": "private, no-store",
          },
        },
      );
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : "Failed to load sites.");
    }
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "GET, POST",
      },
    });
  }

  try {
    const body = await parseJsonBody(request);
    const site = await createSiteInD1(env, normalizeSiteFields(body));

    return json(
      {
        site: mapSiteRowToAdminRecord(site),
        editor: identity.email,
      },
      {
        status: 201,
        headers: {
          "cache-control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Failed to create site.");
  }
}

async function handleAdminSiteDetailRequest(request: Request, env: Env, siteId: number): Promise<Response> {
  const identity = getAdminIdentity(request, env);

  if (!identity) {
    return unauthorizedJson();
  }

  await seedNavigationIfEmpty(env);

  if (request.method === "PATCH") {
    try {
      const body = await parseJsonBody(request);
      const site = await updateSiteInD1(env, siteId, normalizeSiteFields(body));

      return json(
        {
          site: mapSiteRowToAdminRecord(site),
          editor: identity.email,
        },
        {
          headers: {
            "cache-control": "private, no-store",
          },
        },
      );
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : "Failed to update site.");
    }
  }

  if (request.method === "DELETE") {
    try {
      await deleteSiteInD1(env, siteId);

      return json(
        {
          deletedId: siteId,
          editor: identity.email,
        },
        {
          headers: {
            "cache-control": "private, no-store",
          },
        },
      );
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : "Failed to delete site.");
    }
  }

  return new Response("Method Not Allowed", {
    status: 405,
    headers: {
      Allow: "PATCH, DELETE",
    },
  });
}

async function handleAdminSiteReorderRequest(request: Request, env: Env): Promise<Response> {
  const identity = getAdminIdentity(request, env);

  if (!identity) {
    return unauthorizedJson();
  }

  await seedNavigationIfEmpty(env);

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "POST",
      },
    });
  }

  try {
    const body = await parseJsonBody(request);
    const categoryId = typeof (body as { categoryId?: unknown }).categoryId === "number"
      ? (body as { categoryId: number }).categoryId
      : Number.NaN;
    const siteIds = Array.isArray((body as { siteIds?: unknown }).siteIds)
      ? (body as { siteIds: unknown[] }).siteIds.map((value) =>
        typeof value === "number" && Number.isInteger(value) ? value : Number.NaN)
      : [];

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new Error("`categoryId` must be a positive integer.");
    }

    if (!siteIds.length || siteIds.some((value) => !Number.isInteger(value) || value <= 0)) {
      throw new Error("`siteIds` must be an array of positive integers.");
    }

    await reorderSitesInD1(env, categoryId, siteIds);

    return json(
      {
        categoryId,
        siteIds,
        editor: identity.email,
      },
      {
        headers: {
          "cache-control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Failed to reorder sites.");
  }
}

async function handleAssetRequest(request: Request, env: Env, pathname: string): Promise<Response> {
  const key = decodeURIComponent(pathname.replace(/^\/api\/assets\//, ""));

  if (!key) {
    return new Response("Missing asset key", { status: 400 });
  }

  const object = await env.LOGOS.get(key);

  if (object) {
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("cache-control", headers.get("cache-control") ?? LONG_CACHE_CONTROL);
    headers.set("etag", object.httpEtag);

    return new Response(request.method === "HEAD" ? null : object.body, {
      headers,
    });
  }

  const warmedResponse = await warmLogoFromBundledAssets(request, env, key);

  if (warmedResponse) {
    return request.method === "HEAD"
      ? new Response(null, { headers: warmedResponse.headers })
      : warmedResponse;
  }

  return new Response("Not Found", { status: 404 });
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const categoryDetailMatch = url.pathname.match(/^\/api\/admin\/categories\/(\d+)$/);
    const siteDetailMatch = url.pathname.match(/^\/api\/admin\/sites\/(\d+)$/);

    if (url.pathname === "/api/navigation") {
      return handleNavigationRequest(env);
    }

    if (url.pathname === "/api/admin/session") {
      return handleAdminSessionRequest(request, env);
    }

    if (url.pathname === "/api/admin/navigation") {
      return handleAdminNavigationRequest(request, env);
    }

    if (url.pathname === "/api/admin/categories") {
      return handleAdminCategoriesRequest(request, env);
    }

    if (url.pathname === "/api/admin/categories/reorder") {
      return handleAdminCategoryReorderRequest(request, env);
    }

    if (categoryDetailMatch) {
      return handleAdminCategoryDetailRequest(
        request,
        env,
        parsePositiveInteger(categoryDetailMatch[1], "Category id"),
      );
    }

    if (url.pathname === "/api/admin/sites") {
      return handleAdminSitesRequest(request, env);
    }

    if (url.pathname === "/api/admin/sites/reorder") {
      return handleAdminSiteReorderRequest(request, env);
    }

    if (siteDetailMatch) {
      return handleAdminSiteDetailRequest(
        request,
        env,
        parsePositiveInteger(siteDetailMatch[1], "Site id"),
      );
    }

    if (url.pathname.startsWith("/api/assets/")) {
      return handleAssetRequest(request, env, url.pathname);
    }

    if (isAdminAppPath(url.pathname)) {
      const identity = getAdminIdentity(request, env);

      if (!identity) {
        return new Response("Cloudflare Access authentication required for /admin.", {
          status: 401,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "private, no-store",
          },
        });
      }

      return env.ASSETS.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};

export default worker;
