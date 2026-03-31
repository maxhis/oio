import { watch } from "vue";
import { useRoute } from "vue-router";

type RouteMetaValue = string | undefined;

const DEFAULT_TITLE = "oio.dev - 开发者网址导航";
const DEFAULT_DESCRIPTION =
  "oio - 收集国内外优秀开发工具网站、app开发资源网站、灵感创意网站、素材资源网站，定时更新分享优质开发书签。oio.dev";
const DEFAULT_KEYWORDS =
  "app开发,iOS开发,Android开发,React Native开发,Flutter开发,小程序开发,app开发资源,网址导航,创意导航,程序员网址大全,开发者网址大全,跨平台app开发 oio.dev";
const DEFAULT_IMAGE = "/assets/images/oio_banner.png";

function ensureMeta(selector: string, attr: "name" | "property", key: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }

  return element;
}

function setMetaName(name: string, content: string) {
  ensureMeta(`meta[name="${name}"]`, "name", name).setAttribute(
    "content",
    content,
  );
}

function setMetaProperty(property: string, content: string) {
  ensureMeta(`meta[property="${property}"]`, "property", property).setAttribute(
    "content",
    content,
  );
}

function toAbsoluteUrl(value: string) {
  return new URL(value, window.location.origin).toString();
}

function readMeta(meta: Record<string, unknown>, key: string): RouteMetaValue {
  const value = meta[key];
  return typeof value === "string" ? value : undefined;
}

export function useDocumentMeta() {
  const route = useRoute();

  watch(
    () => route.fullPath,
    () => {
      const meta = route.meta as Record<string, unknown>;
      const title = readMeta(meta, "title") ?? DEFAULT_TITLE;
      const description = readMeta(meta, "description") ?? DEFAULT_DESCRIPTION;
      const keywords = readMeta(meta, "keywords") ?? DEFAULT_KEYWORDS;
      const image = readMeta(meta, "image") ?? DEFAULT_IMAGE;
      const bodyClass = readMeta(meta, "bodyClass") ?? "page-body";

      document.title = title;
      document.body.className = bodyClass;

      setMetaName("description", description);
      setMetaName("keywords", keywords);
      setMetaName("twitter:card", "summary_large_image");
      setMetaName("twitter:title", title);
      setMetaName("twitter:description", description);
      setMetaName("twitter:image", toAbsoluteUrl(image));

      setMetaProperty("og:type", "article");
      setMetaProperty("og:url", window.location.href);
      setMetaProperty("og:title", title);
      setMetaProperty("og:description", description);
      setMetaProperty("og:image", toAbsoluteUrl(image));
      setMetaProperty("og:site_name", DEFAULT_TITLE);
    },
    { immediate: true },
  );
}
