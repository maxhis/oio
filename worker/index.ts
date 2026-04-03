import { load } from "cheerio";
import { buildPublicLogoUrl, normalizeLogoObjectKey } from "../src/config/logos";
import { navigationCategories, type Category } from "../src/data/navigation";

interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = unknown>(columnName?: string): Promise<T | null>;
  run(): Promise<unknown>;
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
  delete(key: string): Promise<void>;
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
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
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

interface ResolvedSiteMetadata {
  title: string;
  subTitle: string;
  displayLink: string;
  url: string;
  resolvedUrl: string;
  icon: string;
  iconUrl: string;
  resolution: "full" | "fallback";
}

interface PreparedSiteIcon {
  sourceUrl: string;
  body: ArrayBuffer;
  objectKey: string;
  contentType: string;
}

interface StoredAdminLogo {
  icon: string;
  iconUrl: string;
}

interface SiteSubmissionPayload {
  website: string;
  description: string;
  contact: string;
  company: string;
}

const LONG_CACHE_CONTROL = "public, max-age=31536000, immutable";
const NAVIGATION_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600";
const HOME_PAGE_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600";
const SITE_LOOKUP_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";
const SITE_LOOKUP_USER_AGENT =
  "Mozilla/5.0 (compatible; oio-site-metadata/1.0; +https://oio.15tar.com)";
const ADMIN_LOGO_MAX_BYTES = 2_500_000;
const SUBMISSION_SHORT_WINDOW_MS = 60 * 1000;
const SUBMISSION_LONG_WINDOW_MS = 24 * 60 * 60 * 1000;
const SUBMISSION_MAX_PER_MINUTE = 3;
const SUBMISSION_MAX_PER_DAY = 15;

class SubmissionGuardError extends Error {
  status: number;
  headers?: HeadersInit;

  constructor(message: string, status: number, headers?: HeadersInit) {
    super(message);
    this.name = "SubmissionGuardError";
    this.status = status;
    this.headers = headers;
  }
}

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
  return normalizeLogoObjectKey(icon);
}

function toClientIconValue(iconKey: string): string {
  return iconKey.startsWith("logos/") ? iconKey.slice("logos/".length) : iconKey;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function serializeBootstrapData(value: unknown): string {
  return JSON.stringify(value).replace(/[<\u2028\u2029]/g, (character) => {
    switch (character) {
      case "<":
        return "\\u003c";
      case "\u2028":
        return "\\u2028";
      case "\u2029":
        return "\\u2029";
      default:
        return character;
    }
  });
}

function normalizeOptionalString(value: unknown): string {
  return typeof value === "string" ? collapseWhitespace(value.trim()) : "";
}

function normalizeMultilineText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeExternalUrl(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";

  if (!raw) {
    return "";
  }

  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw) ? raw : `https://${raw}`;

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(candidate);
  } catch {
    throw new Error("Site url must be a valid http or https URL.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("Site url must use http or https.");
  }

  const normalizedPathname = parsedUrl.pathname.replace(/\/+$/, "");
  return `${parsedUrl.protocol}//${parsedUrl.host}${normalizedPathname}${parsedUrl.search}${parsedUrl.hash}`;
}

function isExternalHttpUrl(value: string): boolean {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeKeySegment(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "site";
}

function inferExtensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const matched = pathname.match(/\.(svg|png|jpe?g|webp|ico|gif|avif)$/);
    return matched?.[1] === "jpeg" ? "jpg" : matched?.[1] ?? "";
  } catch {
    return "";
  }
}

function inferExtensionFromFileName(fileName: string): string {
  const matched = fileName.trim().toLowerCase().match(/\.(svg|png|jpe?g|webp|ico|gif|avif)$/);
  return matched?.[1] === "jpeg" ? "jpg" : matched?.[1] ?? "";
}

function inferExtensionFromContentType(contentType: string | null): string {
  const normalizedType = contentType?.toLowerCase() ?? "";

  if (normalizedType.includes("svg")) {
    return "svg";
  }

  if (normalizedType.includes("png")) {
    return "png";
  }

  if (normalizedType.includes("jpeg") || normalizedType.includes("jpg")) {
    return "jpg";
  }

  if (normalizedType.includes("webp")) {
    return "webp";
  }

  if (normalizedType.includes("icon")) {
    return "ico";
  }

  if (normalizedType.includes("gif")) {
    return "gif";
  }

  if (normalizedType.includes("avif")) {
    return "avif";
  }

  return "";
}

function resolveContentType(contentType: string | null, url: string, key: string): string {
  const normalizedType = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";

  if (normalizedType) {
    return normalizedType;
  }

  return guessContentType(inferExtensionFromUrl(url) ? `${key}.${inferExtensionFromUrl(url)}` : key);
}

function createAbsoluteUrl(candidate: string, baseUrl: string): string {
  return new URL(candidate, baseUrl).toString();
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function buildSiteLookupHeaders(kind: "document" | "image", userAgent = SITE_LOOKUP_BROWSER_USER_AGENT): HeadersInit {
  return {
    Accept: kind === "document"
      ? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
      : "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": kind === "document" ? "1" : "0",
    "User-Agent": userAgent,
  };
}

function isHtmlContentType(contentType: string | null): boolean {
  const normalizedType = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";

  return !normalizedType
    || normalizedType === "text/html"
    || normalizedType === "application/xhtml+xml";
}

function isMetadataFetchBlockedStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 406 || status === 429;
}

function inferSiteTitleFromUrl(url: string): string {
  const hostname = extractHostname(url).replace(/^www\./i, "");

  return hostname || url;
}

function buildAdminLogoObjectKey(siteUrl: string, sourceHint: string, bodyHash: string, extension: string): string {
  const siteHost = sanitizeKeySegment(extractHostname(siteUrl));
  const sourceSegment = sanitizeKeySegment(sourceHint);
  const stem = siteHost && siteHost !== "site" ? `${siteHost}-${sourceSegment}` : sourceSegment;

  return `logos/uploads/${stem}-${bodyHash.slice(0, 20)}.${extension}`;
}

function resolveStoredLogoPayload(objectKey: string): StoredAdminLogo {
  const icon = toClientIconValue(objectKey);

  return {
    icon,
    iconUrl: buildPublicLogoUrl(icon),
  };
}

function assertImagePayload(contentType: string | null, sourceHint: string): void {
  const normalizedType = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  const inferredExtension = inferExtensionFromContentType(normalizedType)
    || inferExtensionFromUrl(sourceHint)
    || inferExtensionFromFileName(sourceHint);

  if (normalizedType && normalizedType.startsWith("image/")) {
    return;
  }

  if (inferredExtension) {
    return;
  }

  throw new Error("Logo 文件必须是可识别的图片格式。");
}

async function storeAdminLogoBuffer(
  env: Env,
  body: ArrayBuffer,
  options: {
    siteUrl?: string;
    sourceUrl?: string;
    sourceName?: string;
    contentType?: string | null;
  },
): Promise<StoredAdminLogo> {
  if (body.byteLength === 0) {
    throw new Error("Logo 文件为空。");
  }

  if (body.byteLength > ADMIN_LOGO_MAX_BYTES) {
    throw new Error("Logo 图片不能超过 2.5 MB。");
  }

  const sourceHint = options.sourceUrl || options.sourceName || "";
  assertImagePayload(options.contentType ?? null, sourceHint);
  const objectKeySourceHint = extractHostname(options.sourceUrl ?? "")
    || options.sourceName
    || sourceHint
    || "manual-logo";

  const extension = inferExtensionFromContentType(options.contentType ?? null)
    || inferExtensionFromUrl(options.sourceUrl ?? "")
    || inferExtensionFromFileName(options.sourceName ?? "")
    || "png";
  const bodyHash = await sha1Hex(body);
  const objectKey = buildAdminLogoObjectKey(
    options.siteUrl ?? "",
    objectKeySourceHint,
    bodyHash,
    extension,
  );
  const existingObject = await env.LOGOS.get(objectKey);

  if (!existingObject) {
    await env.LOGOS.put(objectKey, body, {
      httpMetadata: {
        contentType: (options.contentType?.split(";")[0]?.trim().toLowerCase()) || guessContentType(objectKey),
        cacheControl: LONG_CACHE_CONTROL,
      },
    });
  }

  return resolveStoredLogoPayload(objectKey);
}

async function importAdminLogoFromRemoteUrl(env: Env, rawUrl: string, siteUrl = ""): Promise<StoredAdminLogo> {
  const imageUrl = normalizeExternalUrl(rawUrl);
  const response = await fetch(imageUrl, {
    redirect: "follow",
    headers: buildSiteLookupHeaders("image"),
  });

  if (!response.ok) {
    throw new Error(`拉取远程 logo 失败，状态码 ${response.status}。`);
  }

  const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);

  if (Number.isFinite(contentLength) && contentLength > ADMIN_LOGO_MAX_BYTES) {
    throw new Error("远程 logo 图片不能超过 2.5 MB。");
  }

  const body = await response.arrayBuffer();

  return storeAdminLogoBuffer(env, body, {
    siteUrl,
    sourceUrl: response.url || imageUrl,
    contentType: response.headers.get("content-type"),
  });
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function sha1Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
  return toHex(hashBuffer);
}

async function sha256HexText(value: string): Promise<string> {
  const buffer = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return toHex(hashBuffer);
}

function readMetaContent(
  $: ReturnType<typeof load>,
  attribute: "name" | "property",
  acceptedValues: string[],
): string {
  const accepted = new Set(acceptedValues.map((value) => value.toLowerCase()));

  for (const element of $("meta").toArray()) {
    const currentValue = $(element).attr(attribute)?.trim().toLowerCase();

    if (!currentValue || !accepted.has(currentValue)) {
      continue;
    }

    const content = collapseWhitespace($(element).attr("content")?.trim() ?? "");

    if (content) {
      return content;
    }
  }

  return "";
}

function extractDocumentMetadata(html: string): { title: string; subTitle: string; iconCandidates: string[] } {
  const $ = load(html);
  const title = readMetaContent($, "property", ["og:title"])
    || readMetaContent($, "name", ["twitter:title"])
    || collapseWhitespace($("title").first().text());
  const subTitle = readMetaContent($, "property", ["og:description"])
    || readMetaContent($, "name", ["description", "twitter:description"]);
  const iconCandidates: Array<{ href: string; score: number }> = [];

  for (const element of $("link").toArray()) {
    const relTokens = ($(element).attr("rel") ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const href = $(element).attr("href")?.trim() ?? "";

    if (!href) {
      continue;
    }

    let score = 0;

    if (relTokens.includes("apple-touch-icon")) {
      score += 80;
    }

    if (relTokens.includes("icon")) {
      score += 60;
    }

    if (relTokens.includes("shortcut")) {
      score += 8;
    }

    if (!score) {
      continue;
    }

    const sizesValue = $(element).attr("sizes")?.trim() ?? "";
    const numericSizes = sizesValue
      .split(/\s+/)
      .map((size) => {
        const matched = size.match(/^(\d+)x(\d+)$/i);
        return matched ? Math.max(Number.parseInt(matched[1], 10), Number.parseInt(matched[2], 10)) : 0;
      })
      .filter((size) => Number.isFinite(size) && size > 0);

    score += numericSizes.length > 0 ? Math.min(Math.max(...numericSizes), 512) : 16;

    if (href.toLowerCase().includes(".svg")) {
      score += 12;
    }

    iconCandidates.push({ href, score });
  }

  const fallbackImages = [
    readMetaContent($, "property", ["og:image"]),
    readMetaContent($, "name", ["twitter:image"]),
  ].filter(Boolean);

  return {
    title,
    subTitle,
    iconCandidates: [
      ...iconCandidates
        .sort((left, right) => right.score - left.score)
        .map((candidate) => candidate.href),
      ...fallbackImages,
    ],
  };
}

async function fetchSiteIcon(
  siteUrl: string,
  candidateUrls: string[],
): Promise<PreparedSiteIcon | null> {
  const attemptedUrls = Array.from(new Set([
    ...candidateUrls,
    createAbsoluteUrl("/favicon.ico", siteUrl),
  ]));
  const siteHost = sanitizeKeySegment(extractHostname(siteUrl));

  for (const candidateUrl of attemptedUrls) {
    for (const userAgent of [SITE_LOOKUP_BROWSER_USER_AGENT, SITE_LOOKUP_USER_AGENT]) {
      let response: Response;

      try {
        response = await fetch(candidateUrl, {
          redirect: "follow",
          headers: buildSiteLookupHeaders("image", userAgent),
        });
      } catch {
        continue;
      }

      if (!response.ok) {
        continue;
      }

      const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);

      if (Number.isFinite(contentLength) && contentLength > 2_500_000) {
        continue;
      }

      const body = await response.arrayBuffer();

      if (body.byteLength === 0) {
        continue;
      }

      const extension = inferExtensionFromContentType(response.headers.get("content-type"))
        || inferExtensionFromUrl(response.url)
        || inferExtensionFromUrl(candidateUrl)
        || "png";
      const bodyHash = await sha1Hex(body);
      const objectKey = `logos/autofetch/${siteHost}-${bodyHash.slice(0, 20)}.${extension}`;
      const contentType = resolveContentType(response.headers.get("content-type"), response.url, objectKey);

      return {
        sourceUrl: response.url || candidateUrl,
        body,
        objectKey,
        contentType,
      };
    }
  }

  return null;
}

async function ensurePreparedSiteIconStored(
  env: Env,
  preparedIcon: PreparedSiteIcon,
): Promise<{ icon: string; iconUrl: string }> {
  const existingObject = await env.LOGOS.get(preparedIcon.objectKey);

  if (!existingObject) {
    await env.LOGOS.put(preparedIcon.objectKey, preparedIcon.body, {
      httpMetadata: {
        contentType: preparedIcon.contentType,
        cacheControl: LONG_CACHE_CONTROL,
      },
    });
  }

  const icon = toClientIconValue(preparedIcon.objectKey);

  return {
    icon,
    iconUrl: buildPublicLogoUrl(icon),
  };
}

async function persistSiteIconIfNeeded(
  env: Env,
  siteUrl: string,
  icon: string,
): Promise<string> {
  if (!icon) {
    return "default.png";
  }

  if (!isExternalHttpUrl(icon)) {
    return icon;
  }

  const preparedIcon = await fetchSiteIcon(siteUrl, [icon]);

  if (!preparedIcon) {
    throw new Error("保存站点时抓取解析出的 logo 失败，请重新解析后再试。");
  }

  return (await ensurePreparedSiteIconStored(env, preparedIcon)).icon;
}

async function resolveSiteMetadata(env: Env, rawUrl: string): Promise<ResolvedSiteMetadata> {
  const normalizedUrl = normalizeExternalUrl(rawUrl);
  void env;

  let response: Response | null = null;
  let lastStatus = 0;

  for (const userAgent of [SITE_LOOKUP_BROWSER_USER_AGENT, SITE_LOOKUP_USER_AGENT]) {
    try {
      response = await fetch(normalizedUrl, {
        redirect: "follow",
        headers: buildSiteLookupHeaders("document", userAgent),
      });
    } catch {
      continue;
    }

    lastStatus = response.status;

    if (response.ok) {
      break;
    }

    if (!isMetadataFetchBlockedStatus(response.status)) {
      throw new Error(`Failed to fetch site metadata with status ${response.status}.`);
    }
  }

  if (!response) {
    throw new Error("Failed to fetch site metadata.");
  }

  const resolvedUrl = response.url || normalizedUrl;
  let extracted: ReturnType<typeof extractDocumentMetadata> | null = null;

  if (response.ok && isHtmlContentType(response.headers.get("content-type"))) {
    const html = await response.text();

    if (html.trim()) {
      extracted = extractDocumentMetadata(html);
    }
  }

  const resolvedIconCandidates = extracted
    ? extracted.iconCandidates
      .map((candidate) => {
        try {
          return createAbsoluteUrl(candidate, resolvedUrl);
        } catch {
          return "";
        }
      })
      .filter(Boolean)
    : [];
  const preparedIcon = await fetchSiteIcon(resolvedUrl, resolvedIconCandidates);

  if (extracted) {
    return {
      title: extracted.title || inferSiteTitleFromUrl(resolvedUrl),
      subTitle: extracted.subTitle,
      displayLink: normalizedUrl,
      url: normalizedUrl,
      resolvedUrl,
      icon: preparedIcon?.sourceUrl ?? "default.png",
      iconUrl: preparedIcon?.sourceUrl ?? buildPublicLogoUrl("default.png"),
      resolution: "full",
    };
  }

  if (isMetadataFetchBlockedStatus(lastStatus) || preparedIcon) {
    return {
      title: inferSiteTitleFromUrl(resolvedUrl),
      subTitle: "",
      displayLink: normalizedUrl,
      url: normalizedUrl,
      resolvedUrl,
      icon: preparedIcon?.sourceUrl ?? "default.png",
      iconUrl: preparedIcon?.sourceUrl ?? buildPublicLogoUrl("default.png"),
      resolution: "fallback",
    };
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch site metadata with status ${response.status}.`);
  }

  throw new Error("The target site returned an empty or unsupported HTML response.");
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
      iconUrl: buildPublicLogoUrl(site.icon),
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
  const title = normalizeOptionalString(value.title);
  const subTitle = normalizeOptionalString(value.subTitle);
  const url = normalizeExternalUrl(value.url);
  const displayLink = normalizeOptionalString(value.displayLink) || url;
  const icon = normalizeOptionalString(value.icon);

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new Error("Site categoryId is required.");
  }

  if (!title || !subTitle || !url || !icon) {
    throw new Error("Site title, subTitle, url and icon are required.");
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

function normalizeSubmissionFields(value: unknown): SiteSubmissionPayload {
  if (!isRecord(value)) {
    throw new Error("投稿内容格式不正确。");
  }

  let website = "";

  try {
    website = normalizeExternalUrl(value.website);
  } catch {
    throw new Error("请填写有效的网站地址。");
  }

  const description = normalizeMultilineText(value.description);
  const contact = normalizeMultilineText(value.contact);
  const company = normalizeOptionalString(value.company);

  if (!website) {
    throw new Error("请填写网站地址。");
  }

  if (!description) {
    throw new Error("请填写站点简介。");
  }

  if (description.length > 1200) {
    throw new Error("站点简介请控制在 1200 字以内。");
  }

  if (contact.length > 200) {
    throw new Error("联系方式请控制在 200 字以内。");
  }

  return {
    website,
    description,
    contact,
    company,
  };
}

function parseUrlLike(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function hasAllowedSubmissionOrigin(request: Request): boolean {
  const requestUrl = new URL(request.url);
  const originHeader = request.headers.get("origin")?.trim() ?? "";
  const refererHeader = request.headers.get("referer")?.trim() ?? "";
  const sourceUrl = parseUrlLike(originHeader) ?? parseUrlLike(refererHeader);

  if (!sourceUrl) {
    return isLoopbackHostname(requestUrl.hostname);
  }

  if (isLoopbackHostname(requestUrl.hostname)) {
    return isLoopbackHostname(sourceUrl.hostname);
  }

  return sourceUrl.protocol === requestUrl.protocol && sourceUrl.hostname === requestUrl.hostname;
}

function isJsonRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.includes("application/json");
}

function getSubmissionClientFingerprintSource(request: Request): string {
  const ip = request.headers.get("cf-connecting-ip")?.trim() ?? "";
  const userAgent = request.headers.get("user-agent")?.trim() ?? "";
  const country = request.headers.get("cf-ipcountry")?.trim() ?? "";

  return [ip || "unknown-ip", userAgent || "unknown-ua", country || "unknown-country"].join("|");
}

async function ensureSubmissionProtectionSchema(env: Env): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS submission_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fingerprint_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `),
    env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_submission_attempts_fingerprint_created_at
      ON submission_attempts (fingerprint_hash, created_at DESC)
    `),
    env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_submission_attempts_created_at
      ON submission_attempts (created_at DESC)
    `),
  ]);
}

async function enforceSubmissionRateLimit(request: Request, env: Env): Promise<void> {
  await ensureSubmissionProtectionSchema(env);

  const now = Date.now();
  const shortWindowStart = now - SUBMISSION_SHORT_WINDOW_MS;
  const longWindowStart = now - SUBMISSION_LONG_WINDOW_MS;
  const fingerprintHash = await sha256HexText(getSubmissionClientFingerprintSource(request));
  const shortWindowCount = await env.DB
    .prepare(`
      SELECT COUNT(*) AS count
      FROM submission_attempts
      WHERE fingerprint_hash = ? AND created_at >= ?
    `)
    .bind(fingerprintHash, shortWindowStart)
    .first<number>("count");
  const longWindowCount = await env.DB
    .prepare(`
      SELECT COUNT(*) AS count
      FROM submission_attempts
      WHERE fingerprint_hash = ? AND created_at >= ?
    `)
    .bind(fingerprintHash, longWindowStart)
    .first<number>("count");

  if ((shortWindowCount ?? 0) >= SUBMISSION_MAX_PER_MINUTE) {
    throw new SubmissionGuardError(
      "提交过于频繁，请 10 分钟后再试。",
      429,
      { "retry-after": String(Math.ceil(SUBMISSION_SHORT_WINDOW_MS / 1000)) },
    );
  }

  if ((longWindowCount ?? 0) >= SUBMISSION_MAX_PER_DAY) {
    throw new SubmissionGuardError(
      "今天的投稿次数已达到上限，请明天再试。",
      429,
      { "retry-after": String(Math.ceil(SUBMISSION_LONG_WINDOW_MS / 1000)) },
    );
  }

  await env.DB.batch([
    env.DB
      .prepare("INSERT INTO submission_attempts (fingerprint_hash, created_at) VALUES (?, ?)")
      .bind(fingerprintHash, now),
    env.DB
      .prepare("DELETE FROM submission_attempts WHERE created_at < ?")
      .bind(longWindowStart),
  ]);
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
      iconUrl: buildPublicLogoUrl(site.icon),
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

function buildSubmissionTelegramMessage(submission: SiteSubmissionPayload, request: Request): string {
  const submittedAt = new Date().toISOString();
  const userAgent = request.headers.get("user-agent")?.trim().slice(0, 280) ?? "";
  const forwardedFor = request.headers.get("cf-connecting-ip")?.trim() ?? "";
  const details = [
    "oio 投稿",
    "",
    `网站: ${submission.website}`,
    "",
    "简介:",
    submission.description,
    "",
    `联系方式: ${submission.contact || "未填写"}`,
    `提交时间: ${submittedAt}`,
  ];

  if (forwardedFor) {
    details.push(`来源 IP: ${forwardedFor}`);
  }

  if (userAgent) {
    details.push(`User-Agent: ${userAgent}`);
  }

  return details.join("\n");
}

async function sendTelegramMessage(env: Env, text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    throw new Error("submission-channel-unavailable");
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Telegram sendMessage failed.", response.status, body);
    throw new Error("submission-delivery-failed");
  }

  const payload = await response.json() as { ok?: boolean };

  if (!payload.ok) {
    console.error("Telegram API returned a non-ok payload.", payload);
    throw new Error("submission-delivery-failed");
  }
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

  const { results: siteRows } = excludeId
    ? await env.DB
      .prepare("SELECT id, url FROM sites WHERE category_id = ? AND id != ?")
      .bind(categoryId, excludeId)
      .all<{ id: number; url: string }>()
    : await env.DB
      .prepare("SELECT id, url FROM sites WHERE category_id = ?")
      .bind(categoryId)
      .all<{ id: number; url: string }>();

  const normalizedUrl = normalizeExternalUrl(url);
  const duplicateUrl = siteRows.find((site) => {
    try {
      return normalizeExternalUrl(site.url) === normalizedUrl;
    } catch {
      return site.url.trim() === normalizedUrl;
    }
  })?.id;

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
  const { results: siteRows } = await env.DB
    .prepare("SELECT DISTINCT icon_key FROM sites WHERE category_id = ?")
    .bind(categoryId)
    .all<{ icon_key: string }>();

  await env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(categoryId).all();
  await deleteUnusedLogoObjects(env, siteRows.map((row) => row.icon_key));
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
  const persistedIcon = await persistSiteIconIfNeeded(env, fields.url, fields.icon);

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
      buildLogoObjectKey(persistedIcon),
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
  const persistedIcon = await persistSiteIconIfNeeded(env, fields.url, fields.icon);
  const nextIconKey = buildLogoObjectKey(persistedIcon);
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
      nextIconKey,
      nextSortOrder,
      siteId,
    )
    .all();

  if (currentSite.icon_key !== nextIconKey) {
    await deleteUnusedLogoObjects(env, [currentSite.icon_key]);
  }

  return requireSiteRowById(env, siteId);
}

async function deleteSiteInD1(env: Env, siteId: number): Promise<void> {
  const site = await requireSiteRowById(env, siteId);
  await env.DB.prepare("DELETE FROM sites WHERE id = ?").bind(siteId).all();
  await deleteUnusedLogoObjects(env, [site.icon_key]);
}

async function deleteUnusedLogoObjects(env: Env, iconKeys: string[]): Promise<void> {
  const uniqueIconKeys = [...new Set(
    iconKeys
      .map((iconKey) => buildLogoObjectKey(iconKey))
      .filter((iconKey) => iconKey.startsWith("logos/")),
  )];

  if (uniqueIconKeys.length === 0) {
    return;
  }

  const keysToDelete: string[] = [];

  for (const iconKey of uniqueIconKeys) {
    const referenceCount = await env.DB
      .prepare("SELECT COUNT(*) AS referenceCount FROM sites WHERE icon_key = ?")
      .bind(iconKey)
      .first<number>("referenceCount") ?? 0;

    if (referenceCount === 0) {
      keysToDelete.push(iconKey);
    }
  }

  if (keysToDelete.length === 0) {
    return;
  }

  await Promise.all(keysToDelete.map((iconKey) => env.LOGOS.delete(iconKey)));
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

async function loadPublicNavigation(env: Env): Promise<{ categories: Category[]; source: "bootstrap" | "d1" | "fallback" }> {
  try {
    const bootstrapped = await seedNavigationIfEmpty(env);
    const categories = await readNavigationFromD1(env);

    return {
      categories,
      source: bootstrapped ? "bootstrap" : "d1",
    };
  } catch (error) {
    console.error("Failed to load navigation for homepage rendering.", error);

    return {
      categories: mapStaticCategoriesToApiPayload(navigationCategories),
      source: "fallback",
    };
  }
}

function renderSiteSidebar(categories: Category[]): string {
  return [
    '<aside class="site-sidebar">',
    '<header class="site-sidebar__header">',
    '<a href="/" class="site-brand">',
    '<span class="site-brand__badge" aria-hidden="true">',
    '<img src="/assets/images/logo-mark.svg" class="site-brand__mark" alt="" />',
    "</span>",
    '<span class="site-brand__copy">',
    '<span class="site-brand__domain">OIO</span>',
    '<span class="site-brand__text">开发者网址导航</span>',
    "</span>",
    "</a>",
    '<div class="site-sidebar__actions">',
    '<button type="button" class="site-sidebar__toggle site-sidebar__toggle--desktop" aria-label="切换侧边栏">',
    '<span aria-hidden="true">≡</span>',
    "</button>",
    "</div>",
    "</header>",
    '<div class="site-sidebar__intro">',
    '<p class="site-sidebar__kicker">OIO</p>',
    '<p class="site-sidebar__blurb">收集经常回访、值得长期保存的开发资源，把书签整理成真正可浏览的索引。</p>',
    "</div>",
    '<nav class="site-sidebar__nav" aria-label="分类导航">',
    categories.map((category, index) =>
      [
        `<a class="site-sidebar__link${index === 0 ? " is-active" : ""}" href="/#${encodeURIComponent(category.title)}"${index === 0 ? ' aria-current="true"' : ""}>`,
        `<span class="site-sidebar__label">${escapeHtml(category.title)}</span>`,
        "</a>",
      ].join("")).join(""),
    "</nav>",
    '<div class="site-sidebar__footer">',
    '<a href="/about" class="site-sidebar__secondary-link">',
    '<span class="site-sidebar__label">关于本站</span>',
    "</a>",
    '<a href="/#submit" class="site-sidebar__secondary-link">',
    '<span class="site-sidebar__label">我要投稿</span>',
    "</a>",
    "</div>",
    "</aside>",
  ].join("");
}

function renderCategorySections(categories: Category[]): string {
  return categories.map((category) =>
    [
      `<section id="${escapeHtml(category.title)}" class="category-section">`,
      '<header class="category-section__header">',
      `<h2 class="category-section__title"><span>${escapeHtml(category.title)}</span></h2>`,
      "</header>",
      '<div class="site-grid">',
      category.sites.map((site) => {
        const iconUrl = site.iconUrl ?? buildPublicLogoUrl(site.icon);

        return [
          '<article class="site-card">',
          `<a class="site-card__link" href="${escapeHtml(site.url)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(`${site.title} (${site.displayLink})`)}">`,
          '<div class="site-card__icon-wrap">',
          `<img src="${escapeHtml(iconUrl)}" class="site-card__icon" width="44" height="44" alt="${escapeHtml(site.title)}" loading="lazy" decoding="async" />`,
          "</div>",
          '<div class="site-card__body">',
          `<div class="site-card__title">${escapeHtml(site.title)}</div>`,
          `<p class="site-card__desc">${escapeHtml(site.subTitle)}</p>`,
          "</div>",
          "</a>",
          "</article>",
        ].join("");
      }).join(""),
      "</div>",
      "</section>",
    ].join("")).join("");
}

function renderHomePageHtml(categories: Category[]): string {
  const totalSites = categories.reduce((count, category) => count + category.sites.length, 0);
  const currentYear = new Date().getFullYear();
  const copyrightText = currentYear > 2019 ? `© 2019-${currentYear}` : "© 2019";

  return [
    '<div class="site-shell home-page">',
    renderSiteSidebar(categories),
    '<div class="site-shell__backdrop"></div>',
    '<main class="site-main">',
    '<header class="site-mobilebar">',
    '<button type="button" class="site-mobilebar__toggle" aria-label="打开导航菜单">',
    '<span aria-hidden="true">≡</span>',
    "</button>",
    '<a href="/" class="site-mobilebar__brand">OIO</a>',
    "</header>",
    '<section class="hero-panel">',
    '<div class="hero-panel__content">',
    '<h1 class="hero-panel__title">把常用开发资源整理成一份真正可浏览的索引。</h1>',
    '<p class="hero-panel__description">从大前端到大后端，从学习资源到日常工具，把容易遗失在收藏夹里的站点按使用场景归档。</p>',
    "</div>",
    '<div class="hero-panel__stats">',
    '<div class="hero-stat">',
    `<span class="hero-stat__value">${categories.length}</span>`,
    '<span class="hero-stat__label">分类</span>',
    "</div>",
    '<div class="hero-stat">',
    `<span class="hero-stat__value">${totalSites}</span>`,
    '<span class="hero-stat__label">站点</span>',
    "</div>",
    "</div>",
    "</section>",
    `<div class="category-list">${renderCategorySections(categories)}</div>`,
    '<footer class="site-footer">',
    '<div class="site-footer__inner">',
    `<div class="site-footer__text">${escapeHtml(copyrightText)} <a href="/"><strong>OIO</strong></a> by <a href="https://go.15tar.com/blog" target="_blank" rel="noreferrer"><strong>iStar</strong></a></div>`,
    '<div class="site-footer__top"><a href="#" rel="go-top" aria-label="回到顶部">↑</a></div>',
    "</div>",
    "</footer>",
    "</main>",
    "</div>",
  ].join("");
}

async function handleHomePageRequest(request: Request, env: Env): Promise<Response> {
  const assetUrl = new URL("/index.html", request.url);
  const assetResponse = await env.ASSETS.fetch(
    new Request(assetUrl.toString(), {
      method: "GET",
      headers: request.headers,
    }),
  );

  if (!assetResponse.ok) {
    return assetResponse;
  }

  const navigation = await loadPublicNavigation(env);
  const template = await assetResponse.text();
  const html = template
    .replace('class="page-body"', 'class="home-body"')
    .replace("<!--app-html-->", renderHomePageHtml(navigation.categories))
    .replace(
      "<!--app-data-->",
      `<script>window.__OIO_NAV__=${serializeBootstrapData(navigation)};</script>`,
    );
  const headers = new Headers(assetResponse.headers);

  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", HOME_PAGE_CACHE_CONTROL);
  headers.delete("content-length");
  headers.delete("etag");

  return new Response(request.method === "HEAD" ? null : html, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers,
  });
}

async function handleSubmissionRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "POST",
      },
    });
  }

  if (!hasAllowedSubmissionOrigin(request)) {
    return json(
      { error: "投稿来源无效，请直接在本站页面中提交。" },
      {
        status: 403,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }

  if (!isJsonRequest(request)) {
    return json(
      { error: "投稿请求格式不正确。" },
      {
        status: 400,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }

  try {
    const body = await parseJsonBody(request);
    const submission = normalizeSubmissionFields(body);

    if (submission.company) {
      return json(
        { ok: true },
        {
          status: 202,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }

    await enforceSubmissionRateLimit(request, env);
    const message = buildSubmissionTelegramMessage(submission, request);

    await sendTelegramMessage(env, message);

    return json(
      { ok: true },
      {
        status: 201,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof SubmissionGuardError) {
      return json(
        { error: error.message },
        {
          status: error.status,
          headers: {
            "cache-control": "no-store",
            ...error.headers,
          },
        },
      );
    }

    const message = error instanceof Error ? error.message : "Failed to submit site.";
    const isDeliveryError = message === "submission-channel-unavailable"
      || message === "submission-delivery-failed";

    return json(
      {
        error: isDeliveryError
          ? "投稿通道暂时不可用，请稍后再试。"
          : message,
      },
      {
        status: isDeliveryError ? 503 : 400,
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

async function handleAdminSiteResolveRequest(request: Request, env: Env): Promise<Response> {
  const identity = getAdminIdentity(request, env);

  if (!identity) {
    return unauthorizedJson();
  }

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
    const siteUrl = isRecord(body) ? body.url : undefined;
    const metadata = await resolveSiteMetadata(env, typeof siteUrl === "string" ? siteUrl : "");

    return json(metadata, {
      headers: {
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Failed to resolve site metadata.");
  }
}

async function handleAdminLogoRequest(request: Request, env: Env): Promise<Response> {
  const identity = getAdminIdentity(request, env);

  if (!identity) {
    return unauthorizedJson();
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "POST",
      },
    });
  }

  try {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const fileValue = formData.get("file");
      const siteUrlValue = formData.get("siteUrl");

      if (!(fileValue instanceof File)) {
        throw new Error("请先选择一张 logo 图片。");
      }

      const body = await fileValue.arrayBuffer();
      const storedLogo = await storeAdminLogoBuffer(env, body, {
        siteUrl: typeof siteUrlValue === "string" ? siteUrlValue : "",
        sourceName: fileValue.name,
        contentType: fileValue.type,
      });

      return json(storedLogo, {
        headers: {
          "cache-control": "private, no-store",
        },
      });
    }

    if (contentType.includes("application/json")) {
      const body = await parseJsonBody(request);
      const imageUrl = isRecord(body) ? body.url : undefined;
      const siteUrl = isRecord(body) && typeof body.siteUrl === "string" ? body.siteUrl : "";

      const storedLogo = await importAdminLogoFromRemoteUrl(
        env,
        typeof imageUrl === "string" ? imageUrl : "",
        siteUrl,
      );

      return json(storedLogo, {
        headers: {
          "cache-control": "private, no-store",
        },
      });
    }

    throw new Error("Logo 上传仅支持 multipart/form-data 或 application/json。");
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Failed to upload logo.");
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

    if ((url.pathname === "/" || url.pathname === "/index.html") && (request.method === "GET" || request.method === "HEAD")) {
      return handleHomePageRequest(request, env);
    }

    if (url.pathname === "/api/navigation") {
      return handleNavigationRequest(env);
    }

    if (url.pathname === "/api/submissions") {
      return handleSubmissionRequest(request, env);
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

    if (url.pathname === "/api/admin/sites/resolve") {
      return handleAdminSiteResolveRequest(request, env);
    }

    if (url.pathname === "/api/admin/logos") {
      return handleAdminLogoRequest(request, env);
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
