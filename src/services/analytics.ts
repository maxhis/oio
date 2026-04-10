import { nextTick } from "vue";
import type { Router, RouteLocationNormalizedLoaded } from "vue-router";

const DEFAULT_TITLE = "OIO - 开发者网址导航";
const GA_SCRIPT_ID = "oio-ga4-script";
const CLARITY_SCRIPT_ID = "oio-clarity-script";
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
const CLARITY_PROJECT_ID = import.meta.env.VITE_CLARITY_PROJECT_ID?.trim();

type AnalyticsEventValue = string | number | boolean | undefined;
type AnalyticsEventParams = Record<string, AnalyticsEventValue>;

let hasInitializedAnalytics = false;
let hasInitializedClarity = false;
let lastGaTrackedPath = "";
let lastClarityTrackedPath = "";

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function toEventParams(params: AnalyticsEventParams) {
  return Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, string | number | boolean] => {
      const [, value] = entry;
      return value !== undefined;
    }),
  );
}

function ensureScript(id: string, src: string) {
  const existing = document.getElementById(id) as HTMLScriptElement | null;

  if (existing) {
    return existing;
  }

  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
  return script;
}

function initGoogleAnalytics() {
  if (!isBrowser() || !GA_MEASUREMENT_ID) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };

  ensureScript(GA_SCRIPT_ID, `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`);
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    anonymize_ip: true,
    debug_mode: import.meta.env.DEV,
    send_page_view: false,
  });
}

function initClarity() {
  if (!isBrowser() || !CLARITY_PROJECT_ID || hasInitializedClarity) {
    return;
  }

  const clarity =
    window.clarity ||
    Object.assign(
      (...args: unknown[]) => {
        clarity.q = clarity.q || [];
        clarity.q.push(args);
      },
      { q: [] as unknown[][] },
    );

  window.clarity = clarity;
  ensureScript(CLARITY_SCRIPT_ID, `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`);
  hasInitializedClarity = true;
}

function readRouteTitle(route: RouteLocationNormalizedLoaded) {
  const routeTitle = route.meta?.title;
  return typeof routeTitle === "string" ? routeTitle : document.title || DEFAULT_TITLE;
}

function trackPageView(route: RouteLocationNormalizedLoaded) {
  if (!isBrowser()) {
    return;
  }

  const pagePath = route.fullPath || `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const pageTitle = readRouteTitle(route);
  const eventParams = {
    language: navigator.language,
    page_location: window.location.href,
    page_path: pagePath,
    page_title: pageTitle,
  };

  if (GA_MEASUREMENT_ID && typeof window.gtag === "function" && pagePath !== lastGaTrackedPath) {
    lastGaTrackedPath = pagePath;
    window.gtag("event", "page_view", eventParams);
  }

  if (CLARITY_PROJECT_ID && typeof window.clarity === "function" && pagePath !== lastClarityTrackedPath) {
    lastClarityTrackedPath = pagePath;
    window.clarity("set", "page_path", pagePath);
    window.clarity("set", "page_title", pageTitle);
    window.clarity("event", "page_view");
  }
}

export function trackEvent(name: string, params: AnalyticsEventParams = {}) {
  if (!isBrowser()) {
    return;
  }

  const eventParams = toEventParams(params);

  if (GA_MEASUREMENT_ID && typeof window.gtag === "function") {
    window.gtag("event", name, eventParams);
  }

  if (CLARITY_PROJECT_ID && typeof window.clarity === "function") {
    window.clarity("event", name);
  }
}

export function trackOutboundClick(input: {
  categoryTitle: string;
  siteTitle: string;
  destinationUrl: string;
  displayLink: string;
}) {
  let destinationDomain: string | undefined;

  try {
    destinationDomain = new URL(input.destinationUrl).hostname;
  } catch {
    destinationDomain = undefined;
  }

  trackEvent("outbound_click", {
    category_title: input.categoryTitle,
    destination_domain: destinationDomain,
    destination_url: input.destinationUrl,
    link_text: input.displayLink,
    site_title: input.siteTitle,
  });
}

export function initAnalytics(router: Router) {
  if (!isBrowser() || hasInitializedAnalytics) {
    return;
  }

  hasInitializedAnalytics = true;

  initGoogleAnalytics();
  initClarity();

  router.afterEach((to) => {
    void nextTick(() => {
      trackPageView(to);
    });
  });

  void router.isReady().then(() =>
    nextTick(() => {
      trackPageView(router.currentRoute.value);
    }),
  );
}
