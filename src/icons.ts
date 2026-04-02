import type { Component } from "vue";
import {
  BookOpen,
  ChevronUp,
  Code2,
  Compass,
  FolderKanban,
  FileText,
  Gem,
  Globe,
  GraduationCap,
  Github,
  Heart,
  Lightbulb,
  Palette,
  Mail,
  Menu,
  PenTool,
  Server,
  Sparkles,
  Smartphone,
  Star,
  Wrench,
  X,
} from "lucide-vue-next";

export const uiIcons = {
  menu: Menu,
  close: X,
  heart: Heart,
  mail: Mail,
  github: Github,
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
  design: Palette,
  ai: Sparkles,
  code: Code2,
  product: FolderKanban,
  docs: BookOpen,
  explore: Compass,
  study: GraduationCap,
  utility: Wrench,
} satisfies Record<string, Component>;

export type CategoryIconKey = keyof typeof categoryIcons;

export const categoryIconOptions: Array<{ key: CategoryIconKey; label: string }> = [
  { key: "featured", label: "推荐" },
  { key: "frontend", label: "前端" },
  { key: "backend", label: "后端" },
  { key: "blog", label: "博客" },
  { key: "discovery", label: "发现" },
  { key: "learning", label: "学习" },
  { key: "tools", label: "工具" },
  { key: "essentials", label: "常用" },
  { key: "design", label: "设计" },
  { key: "ai", label: "AI" },
  { key: "code", label: "开发" },
  { key: "product", label: "产品" },
  { key: "docs", label: "文档" },
  { key: "explore", label: "探索" },
  { key: "study", label: "课程" },
  { key: "utility", label: "效率" },
];
