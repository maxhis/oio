const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export interface AdminSession {
  email: string;
  source: string;
}

export interface AdminSite {
  id: number;
  categoryId: number;
  title: string;
  subTitle: string;
  displayLink: string;
  url: string;
  icon: string;
  sortOrder: number;
}

export interface AdminCategory {
  id: number;
  title: string;
  icon: string;
  sortOrder: number;
  sites: AdminSite[];
}

export interface AdminNavigationResponse {
  categories: AdminCategory[];
  source: string;
  editor?: string;
}

export interface CategoryInput {
  title: string;
  icon: string;
}

export interface SiteInput {
  categoryId: number;
  title: string;
  subTitle: string;
  displayLink: string;
  url: string;
  icon: string;
}

export interface ResolvedSiteMetadata {
  title: string;
  subTitle: string;
  displayLink: string;
  url: string;
  resolvedUrl: string;
  icon: string;
  iconUrl: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const payload = await response.json() as { error?: string };
      message = payload.error || message;
    } catch {
      const text = await response.text();
      message = text || message;
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function createEmptyCategoryInput(): CategoryInput {
  return {
    title: "",
    icon: "featured",
  };
}

export function createEmptySiteInput(categoryId = 0): SiteInput {
  return {
    categoryId,
    title: "",
    subTitle: "",
    displayLink: "",
    url: "",
    icon: "default.png",
  };
}

export function buildAdminIconUrl(icon: string): string {
  const sanitized = icon.startsWith("logos/") ? icon : `logos/${icon}`;
  const encodedPath = sanitized
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${API_BASE_URL}/api/assets/${encodedPath}`;
}

export async function loadAdminSession(): Promise<AdminSession> {
  return request<AdminSession>("/api/admin/session");
}

export async function loadAdminNavigation(): Promise<AdminNavigationResponse> {
  return request<AdminNavigationResponse>("/api/admin/navigation");
}

export async function createAdminCategory(input: CategoryInput): Promise<{ category: AdminCategory }> {
  return request<{ category: AdminCategory }>("/api/admin/categories", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function updateAdminCategory(categoryId: number, input: CategoryInput): Promise<{ category: AdminCategory }> {
  return request<{ category: AdminCategory }>(`/api/admin/categories/${categoryId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function deleteAdminCategory(categoryId: number): Promise<{ deletedId: number }> {
  return request<{ deletedId: number }>(`/api/admin/categories/${categoryId}`, {
    method: "DELETE",
  });
}

export async function reorderAdminCategories(categoryIds: number[]): Promise<{ categoryIds: number[] }> {
  return request<{ categoryIds: number[] }>("/api/admin/categories/reorder", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ categoryIds }),
  });
}

export async function createAdminSite(input: SiteInput): Promise<{ site: AdminSite }> {
  return request<{ site: AdminSite }>("/api/admin/sites", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function updateAdminSite(siteId: number, input: SiteInput): Promise<{ site: AdminSite }> {
  return request<{ site: AdminSite }>(`/api/admin/sites/${siteId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function deleteAdminSite(siteId: number): Promise<{ deletedId: number }> {
  return request<{ deletedId: number }>(`/api/admin/sites/${siteId}`, {
    method: "DELETE",
  });
}

export async function reorderAdminSites(categoryId: number, siteIds: number[]): Promise<{ categoryId: number; siteIds: number[] }> {
  return request<{ categoryId: number; siteIds: number[] }>("/api/admin/sites/reorder", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ categoryId, siteIds }),
  });
}

export async function resolveAdminSiteMetadata(url: string): Promise<ResolvedSiteMetadata> {
  return request<ResolvedSiteMetadata>("/api/admin/sites/resolve", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ url }),
  });
}
