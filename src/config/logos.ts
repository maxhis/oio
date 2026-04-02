export const PUBLIC_LOGO_BASE_URL = "https://oio-logos.15tar.com";

export function normalizeLogoObjectKey(icon: string): string {
  return icon.startsWith("logos/") ? icon : `logos/${icon}`;
}

export function buildPublicLogoUrl(icon: string): string {
  const encodedPath = normalizeLogoObjectKey(icon)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${PUBLIC_LOGO_BASE_URL}/${encodedPath}`;
}
