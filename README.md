# OIO

一个基于 `Vue 3 + Vite + Cloudflare Workers + D1 + R2` 的网址导航项目。

这个仓库可以直接开源自托管，但它当前带有示例数据、作者品牌文案和作者自己的域名配置。你在部署自己的版本前，需要先把这些默认值替换成自己的站点信息。

## 技术栈

- 前端：`Vue 3` + `Vite` + `vue-router`
- 后端：`Cloudflare Workers`
- 数据库：`Cloudflare D1`
- 图片存储：`Cloudflare R2`
- 后台保护：`Cloudflare Access`

## 架构说明

- 页面静态资源由 Vite 构建到 `dist`
- Worker 提供 `/api/*`、`/admin` 和首页服务端注入逻辑
- 首页正文由 Worker 注入 HTML，爬虫拿到的不是空壳页
- 导航数据存储在 D1
- 站点 logo 存储在 R2，并通过公开自定义域名直接访问
- `/admin` 和 `/api/admin/*` 依赖 Cloudflare Access 保护

## 部署前必做

### 1. 替换品牌和域名

这个仓库默认包含以下作者相关内容：

- 站点域名：`oio.15tar.com`
- logo 域名：`oio-logos.15tar.com`
- 作者链接：`go.15tar.com`
- 作者名：`iStar`

部署你自己的版本前，至少搜索并替换这些值：

```bash
rg -n "oio\.15tar\.com|oio-logos\.15tar\.com|go\.15tar\.com|iStar" src worker README.md wrangler.toml
```

重点文件：

- [`wrangler.toml`](./wrangler.toml)
- [`src/config/logos.ts`](./src/config/logos.ts)
- [`src/router/index.ts`](./src/router/index.ts)
- [`src/components/SidebarMenu.vue`](./src/components/SidebarMenu.vue)
- [`src/components/AppFooter.vue`](./src/components/AppFooter.vue)
- [`src/views/HomeView.vue`](./src/views/HomeView.vue)
- [`src/views/AboutView.vue`](./src/views/AboutView.vue)
- [`worker/index.ts`](./worker/index.ts)

### 2. 决定是否保留“投稿”功能

公开投稿接口 `/api/submissions` 会把用户提交的网站信息转发到 Telegram。

如果你要保留这个功能，需要配置：

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

如果你不打算使用投稿功能：

- 可以不配置这两个 secret
- 但当前 UI 仍然会显示“我要投稿”，提交时接口会失败
- 最好同步移除或隐藏前端投稿入口

## 先决条件

你需要准备：

- Node.js 22+
- `pnpm`
- 一个 Cloudflare 账号
- 一个你可控的域名
- 可选：Cloudflare Zero Trust，用于后台访问控制

## 本地开发

### 安装依赖

```bash
pnpm install
```

### 只跑前端静态开发

```bash
pnpm dev
```

这个模式只启动 Vite，不包含 Worker、D1 和 R2。

### 本地联调完整 Worker

```bash
pnpm build
pnpm cf:dev
```

默认本地地址是：

- `http://127.0.0.1:8787`
- `http://localhost:8787`

如果你希望继续用 `pnpm dev` 单独跑前端，同时把 API 指到本地 Worker，可以创建 `.env.local`：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8787
```

### 本地后台登录

如果你需要本地访问 `/admin`，创建 `.dev.vars`：

```bash
ADMIN_DEV_USER_EMAIL=local-dev@example.com
TELEGRAM_BOT_TOKEN=123456:example-token
TELEGRAM_CHAT_ID=123456789
```

说明：

- `ADMIN_DEV_USER_EMAIL` 用于本地模拟后台身份
- `TELEGRAM_*` 只在你要本地测试投稿时需要

## Cloudflare 自托管部署

### 1. 创建 Cloudflare 资源

先创建 D1 和 R2：

```bash
pnpm wrangler d1 create oio
pnpm wrangler r2 bucket create oio-logos
pnpm wrangler r2 bucket create oio-logos-preview
```

你也可以改成自己的资源名，但要注意：

- 如果你修改了 D1 数据库名，记得同步修改 [`package.json`](./package.json) 里的 `cf:d1:migrate:*` 脚本
- 如果你修改了 bucket 名，记得同步修改 [`wrangler.toml`](./wrangler.toml)

### 2. 更新 `wrangler.toml`

把 `wrangler d1 create` 返回的真实 `database_id` 写回 [`wrangler.toml`](./wrangler.toml)。

同时把里面的路由改成你自己的站点域名，例如：

```toml
routes = [
  { pattern = "nav.example.com/", zone_name = "example.com" },
  { pattern = "nav.example.com/index.html", zone_name = "example.com" },
  { pattern = "nav.example.com/api/*", zone_name = "example.com" },
  { pattern = "nav.example.com/admin", zone_name = "example.com" },
  { pattern = "nav.example.com/admin/*", zone_name = "example.com" },
]
```

这些根路径非常重要：

- `/`
- `/index.html`

项目当前依赖 Worker 接管首页请求，才能输出服务端注入后的正文 HTML。如果你漏掉这两个路由，首页会直接退回成静态壳页面。

### 3. 给 R2 配公开自定义域名

这个项目默认假设 logo 通过公开 R2 域名直接访问，而不是走 Worker 代理。

你需要在 Cloudflare R2 里为 logo bucket 配一个公开域名，例如：

- `logos.example.com`

配置完成后，更新 [`src/config/logos.ts`](./src/config/logos.ts)：

```ts
export const PUBLIC_LOGO_BASE_URL = "https://logos.example.com";
```

这个域名必须和你的 R2 public custom domain 保持一致，否则前端会请求错误的 logo 地址。

### 4. 执行 D1 migration

本地：

```bash
pnpm cf:d1:migrate:local
```

远端：

```bash
pnpm cf:d1:migrate:remote
```

schema 位于 [`migrations/0001_navigation.sql`](./migrations/0001_navigation.sql)。

### 5. 配置运行时变量和 Secret

至少考虑这些变量：

- `ADMIN_DEV_USER_EMAIL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

线上推荐：

- 本地开发用 `.dev.vars`
- 生产环境用 `wrangler secret put`

例如：

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
```

说明：

- `ADMIN_DEV_USER_EMAIL` 只用于本地开发，不建议在线上依赖
- `TELEGRAM_*` 不配置不会影响首页浏览，但会导致投稿接口不可用

## 配置 Cloudflare Access

推荐在 Cloudflare Zero Trust 里创建一个 Self-hosted application，至少保护：

- `/admin`
- `/admin/*`
- `/api/admin/*`

Worker 会读取请求头：

- `Cf-Access-Authenticated-User-Email`

作为后台身份来源。

如果你没给这些路径加 Cloudflare Access，生产环境里的 `/admin` 会因为拿不到身份而返回 `401`。

## 首次上线前的数据说明

项目内置了一份示例导航数据：

- [`src/data/navigation.ts`](./src/data/navigation.ts)

当 D1 还是空库时，Worker 会自动把这份数据 bootstrap 进数据库。

这意味着你有两种选择：

1. 在首次部署前就修改 [`src/data/navigation.ts`](./src/data/navigation.ts) 为你自己的默认数据
2. 先部署，再通过 `/admin` 后台继续编辑

如果你不想让示例站点短暂出现在你的线上站点里，应该在首次远端 migration 和 deploy 前就先替换这份数据。

## 构建与部署

### 本地构建

```bash
pnpm build
pnpm preview
```

### 发布到 Cloudflare Workers

```bash
pnpm cf:deploy
```

注意：

- 不要只把 `dist` 当成纯静态站点部署
- 这个项目必须通过 Worker 发布，否则 `/api/*`、首页服务端注入、后台保护都会失效

当前 `cf:deploy` 已经带了：

```bash
wrangler deploy --keep-vars
```

这样可以避免部署时把 Dashboard 中已有的普通 `vars` 清掉。

## Cloudflare Git 自动部署

这个项目可以直接接 Cloudflare Workers 自带的 Git 自动部署，不依赖 GitHub Actions。

推荐配置：

- Build command: `pnpm build`
- Deploy command: `pnpm cf:deploy`
- Root directory: `/`
- Production branch: 你的生产分支

注意：

- Cloudflare Build 的 “Variables and secrets” 只影响构建阶段
- Worker 运行时依赖的变量和 secret 仍然要在 Worker 自己的 Variables / Secrets 里配置

## 常见问题

### 首页只返回一个空壳，SEO 无效

通常是这几类问题：

- `wrangler.toml` 没有把 `/` 和 `/index.html` 路由交给 Worker
- `run_worker_first` 没包含 `/` 和 `/index.html`
- 你把项目按纯静态站点部署了，而不是 Worker

### logo 加载失败

通常是这几类问题：

- R2 bucket 没配置公开 custom domain
- [`src/config/logos.ts`](./src/config/logos.ts) 里的 `PUBLIC_LOGO_BASE_URL` 还是原作者域名
- R2 中对象 key 和数据库里的 `icon_key` 不一致

### `/admin` 打不开或返回 401

通常是：

- 没配置 Cloudflare Access
- 访问路径不在受保护范围里
- 本地开发没设置 `ADMIN_DEV_USER_EMAIL`

### 投稿一直失败

通常是：

- 没配置 `TELEGRAM_BOT_TOKEN`
- 没配置 `TELEGRAM_CHAT_ID`
- Telegram bot 没有权限向目标 chat 发送消息

### 新 migration 没生效

Cloudflare Git 自动部署不会自动帮你执行 D1 migration。  
只要新增了 migration 文件，就要先手动运行：

```bash
pnpm cf:d1:migrate:remote
```

然后再重新部署：

```bash
pnpm cf:deploy
```

## 自检清单

在你宣布站点可用前，至少确认以下项目：

- 域名、品牌文案、作者链接都已替换
- `wrangler.toml` 的 routes 已改成你的域名
- `src/config/logos.ts` 的 `PUBLIC_LOGO_BASE_URL` 已改成你的 R2 域名
- 远端 D1 migration 已执行
- R2 public custom domain 已生效
- `/` 能正常打开，并能看到真实正文而不是空壳
- `/admin` 已被 Cloudflare Access 保护
- 如果保留投稿功能，`TELEGRAM_*` 已配置完成
