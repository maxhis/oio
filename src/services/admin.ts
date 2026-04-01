import type { Category } from "../data/navigation";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export interface AdminSession {
  email: string;
  source: string;
}

export interface AdminNavigationResponse {
  categories: Category[];
  source: string;
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
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function stripRuntimeFields(categories: Category[]): Category[] {
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

export async function loadAdminSession(): Promise<AdminSession> {
  return request<AdminSession>("/api/admin/session");
}

export async function loadAdminNavigation(): Promise<AdminNavigationResponse> {
  const payload = await request<AdminNavigationResponse>("/api/admin/navigation");

  return {
    ...payload,
    categories: stripRuntimeFields(payload.categories),
  };
}

export async function saveAdminNavigation(categories: Category[]): Promise<AdminNavigationResponse> {
  const payload = await request<AdminNavigationResponse>("/api/admin/navigation", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      categories: stripRuntimeFields(categories),
    }),
  });

  return {
    ...payload,
    categories: stripRuntimeFields(payload.categories),
  };
}
