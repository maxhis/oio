# 将静态站改造成标准 Vue 3 + Vite 项目

## Summary
把当前仓库改造成 `Vue 3 + Vite + Vue Router + TypeScript` 的标准 SPA 项目，保留现有 Xenon/Bootstrap 视觉基础，但去掉页面内联 Vue 2 写法和主要 jQuery 交互，改为组件化、路由化、模块化实现。首页、关于页、404 统一进入同一套应用结构。

## Key Changes
- 建立标准工程骨架：新增 `package.json`、`vite.config.ts`、`tsconfig*.json`、`src/`、`public/`，根目录 HTML 收敛为 Vite 入口。
- 迁移静态资源：
  - `assets/images` 与不需要构建处理的图标字体放入 `public/` 或按用途拆分。
  - 现有页面级数据从 `index.html` 内联 `categories` 抽到 `src/data/navigation.ts`，为首页组件提供类型化数据源。
- 重建应用入口：
  - `src/main.ts` 挂载 Vue 应用。
  - `src/App.vue` 承载整体布局。
  - `src/router/index.ts` 定义 `/`、`/about`、`/:pathMatch(.*)*`。
- 组件化页面与布局：
  - 侧边菜单、分类区块、站点卡片、页脚拆成独立组件。
  - 首页保留当前信息架构和样式类名，避免视觉回归。
  - 关于页迁移为独立路由页面，404 页迁移为 catch-all 路由页面。
- 现代化交互替换：
  - 去掉 `new Vue(...)` 和 `Vue.component(...)` 的内联实现。
  - 去掉用于菜单激活、平滑滚动、侧边栏状态控制的 jQuery 页面脚本，改为 Vue 事件、响应式状态和原生滚动 API。
  - 对必须依赖旧模板脚本的部分做最小兼容保留；若 Xenon 某些 JS 仅服务于已被 Vue 接管的行为，则不再引入。
- SEO 与页面元信息：
  - 保留现有 title/description/OG/Twitter 文案。
  - 首页、关于页、404 根据路由分别设置页面标题和关键 meta。
- 兼容现有部署：
  - 默认按站点部署在域名根路径处理。
  - `about.html`、`404.html` 的旧直链将改为 `/about` 与路由 404；若静态托管需要回退规则，计划中同步补充部署说明。

## Public Interfaces / Types
- 新增类型：
  - `Category`
  - `SiteLink`
- 新增前端模块接口：
  - 路由表：`/`、`/about`、`/:pathMatch(.*)*`
  - 数据模块：导航分类数据作为可导入 TS 常量提供
- 不新增后端接口；站点仍为纯前端静态部署。

## Test Plan
- 构建与基础验证：
  - `npm install`
  - `npm run dev`
  - `npm run build`
  - `npm run preview`
- 页面与路由验证：
  - 首页正常渲染分类、站点卡片、侧边导航。
  - `/about` 内容完整迁移，站内跳转正常。
  - 任意不存在路径进入 404 页面。
- 交互验证：
  - 侧边菜单可定位到分类锚点。
  - 分类激活态、移动端菜单展开/收起正常。
  - 站点卡片外链打开行为与原站一致。
- 回归验证：
  - 图片、favicon、logo、字体文件路径全部正常。
  - 现有主要样式不丢失，无明显布局破坏。
  - 生产构建后静态资源引用正确，无根路径错误。

## Assumptions
- 采用 `Vue 3 + Vite + TypeScript + Vue Router`。
- 迁移目标是“标准工程化 + 部分现代化”，不是重做视觉设计。
- 默认部署在根路径，不额外支持子目录 `base`。
- Google Analytics 现有埋点先按原逻辑保留，后续如需升级可再替换为更现代的接入方式。
- 旧 Xenon/Bootstrap CSS 保留，只有在确认无依赖后才移除对应 JS。
