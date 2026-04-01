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
}

interface SiteRow {
  category_id: number;
  title: string;
  sub_title: string;
  display_link: string;
  url: string;
  icon_key: string;
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

async function readNavigationFromD1(env: Env): Promise<Category[]> {
  const { results: categories } = await env.DB
    .prepare("SELECT id, title, icon FROM categories ORDER BY sort_order ASC, id ASC")
    .all<CategoryRow>();

  if (categories.length === 0) {
    return [];
  }

  const { results: sites } = await env.DB
    .prepare(
      [
        "SELECT category_id, title, sub_title, display_link, url, icon_key",
        "FROM sites",
        "ORDER BY category_id ASC, sort_order ASC, id ASC",
      ].join(" "),
    )
    .all<SiteRow>();

  const sitesByCategoryId = new Map<number, SiteRow[]>();

  sites.forEach((site) => {
    const nextSites = sitesByCategoryId.get(site.category_id) ?? [];
    nextSites.push(site);
    sitesByCategoryId.set(site.category_id, nextSites);
  });

  return categories.map((category) => ({
    title: category.title,
    icon: category.icon,
    sites: (sitesByCategoryId.get(category.id) ?? []).map((site) => ({
      title: site.title,
      subTitle: site.sub_title,
      displayLink: site.display_link,
      url: site.url,
      icon: toClientIconValue(site.icon_key),
      iconUrl: buildApiIconUrl(site.icon_key),
    })),
  }));
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
    const categories = stripRuntimeFields(await readNavigationFromD1(env));

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
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return badRequest("Request body must be valid JSON.");
    }

    const categoriesValue = (body as { categories?: unknown }).categories;

    try {
      const normalizedCategories = normalizeCategoriesInput(categoriesValue);
      await replaceNavigationInD1(env, normalizedCategories);

      return json(
        {
          categories: stripRuntimeFields(normalizedCategories),
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

    if (url.pathname === "/api/navigation") {
      return handleNavigationRequest(env);
    }

    if (url.pathname === "/api/admin/session") {
      return handleAdminSessionRequest(request, env);
    }

    if (url.pathname === "/api/admin/navigation") {
      return handleAdminNavigationRequest(request, env);
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
