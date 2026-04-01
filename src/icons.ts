import type { Component } from "vue";
import {
  ChevronUp,
  FileText,
  Gem,
  Globe,
  Heart,
  Lightbulb,
  Mail,
  Menu,
  PenTool,
  Server,
  Smartphone,
  Star,
  X,
} from "lucide-vue-next";

export const uiIcons = {
  menu: Menu,
  close: X,
  heart: Heart,
  mail: Mail,
  chevronUp: ChevronUp,
} satisfies Record<string, Component>;

export const categoryIcons = {
  featured: Star,
  frontend: Smartphone,
  backend: Server,
  blog: FileText,
  discovery: Lightbulb,
  learning: PenTool,
  tools: Gem,
  essentials: Globe,
} satisfies Record<string, Component>;
