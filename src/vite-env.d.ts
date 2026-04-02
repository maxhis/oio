/// <reference types="vite/client" />

import type { Category } from "./data/navigation";

declare global {
  interface Window {
    __OIO_NAV__?: {
      categories?: Category[];
      source?: string;
    };
  }
}

export {};
