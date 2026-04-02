import { buildPublicLogoUrl } from "../config/logos";
import { navigationCategories, type Category } from "../data/navigation";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

let bootstrappedCategories: Category[] | null | undefined;

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
    && (record.iconUrl === undefined || typeof record.iconUrl === "string")
  );
}

function withPublicIconUrls(categories: Category[]): Category[] {
  return categories.map((category) => ({
    ...category,
    sites: category.sites.map((site) => ({
      ...site,
      iconUrl: buildPublicLogoUrl(site.icon),
    })),
  }));
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

export const fallbackNavigationCategories = withPublicIconUrls(navigationCategories);

function readBootstrappedCategories(): Category[] | null {
  if (bootstrappedCategories !== undefined) {
    return bootstrappedCategories;
  }

  if (typeof window === "undefined") {
    bootstrappedCategories = null;
    return bootstrappedCategories;
  }

  const payload = window.__OIO_NAV__;
  bootstrappedCategories = Array.isArray(payload?.categories) && payload.categories.every(isCategoryRecord)
    ? payload.categories
    : null;

  return bootstrappedCategories;
}

export function getInitialNavigationCategories(): Category[] {
  return readBootstrappedCategories() ?? fallbackNavigationCategories;
}

export async function loadNavigationCategories(): Promise<Category[]> {
  const bootstrapped = readBootstrappedCategories();

  if (bootstrapped) {
    return bootstrapped;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/navigation`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Unexpected response: ${response.status}`);
    }

    const payload = await response.json() as { categories?: unknown };

    if (!Array.isArray(payload.categories) || !payload.categories.every(isCategoryRecord)) {
      throw new Error("Invalid navigation payload");
    }

    return payload.categories;
  } catch (error) {
    console.warn("Failed to load navigation from API, using local fallback.", error);
    return fallbackNavigationCategories;
  }
}
