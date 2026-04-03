/// <reference types="vite/client" />

import type { Category } from "./data/navigation";

declare global {
  interface Window {
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[][] };
    __OIO_NAV__?: {
      categories?: Category[];
      source?: string;
    };
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }

  interface ImportMetaEnv {
    readonly VITE_CLARITY_PROJECT_ID?: string;
    readonly VITE_GA_MEASUREMENT_ID?: string;
  }
}

export {};
