import { navigationCategories, type Category } from "../data/navigation";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const LOCAL_LOGO_BASE = "/assets/images/logos";

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

function withLocalIconUrls(categories: Category[]): Category[] {
  return categories.map((category) => ({
    ...category,
    sites: category.sites.map((site) => ({
      ...site,
      iconUrl: `${LOCAL_LOGO_BASE}/${site.icon}`,
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

export const fallbackNavigationCategories = withLocalIconUrls(navigationCategories);

export async function loadNavigationCategories(): Promise<Category[]> {
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
