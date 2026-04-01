[➡️ oio.15tar.com](https://oio.15tar.com) - 开发者网址导航

## Development

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
pnpm preview
```

## Cloudflare 持久化

项目现在分成两部分：

- 页面静态资源继续由 Vite 构建到 `dist`
- `/api/navigation` 通过 Cloudflare Worker 提供
- `/admin` 和 `/api/admin/*` 通过 Cloudflare Access 保护
- 分类和站点数据持久化到 D1
- 站点图标通过 R2 提供；如果对象还没写入 R2，Worker 会从当前仓库内置图标自动回填到 R2

### 1. 创建资源

```bash
pnpm install
pnpm wrangler d1 create oio
pnpm wrangler r2 bucket create oio-logos
pnpm wrangler r2 bucket create oio-logos-preview
```

把 `wrangler d1 create oio` 输出的真实 `database_id` 写回 [`wrangler.toml`](/Users/istar/proj/oio/wrangler.toml)。

### 2. 执行 D1 migration

本地：

```bash
pnpm cf:d1:migrate:local
```

远端：

```bash
pnpm cf:d1:migrate:remote
```

schema 位于 [`migrations/0001_navigation.sql`](/Users/istar/proj/oio/migrations/0001_navigation.sql)。

### 3. 本地联调 Worker

```bash
pnpm build
pnpm cf:dev
```

如果你需要本地访问 `/admin`，可以在 `.dev.vars` 里增加一个开发身份：

```bash
ADMIN_DEV_USER_EMAIL=local-dev@oio.local
```

如果前端仍然使用 `pnpm dev` 单独启动 Vite，可在 `.env.local` 里配置：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8787
```

### 4. 配置 Cloudflare Access

建议在 Cloudflare Zero Trust 里创建一个 Self-hosted application，至少保护以下路径：

- `/admin`
- `/admin/*`
- `/api/admin/*`

登录方式可以先用邮箱一次性验证码，或者接你自己的 IdP。

Worker 当前会读取 `Cf-Access-Authenticated-User-Email` 作为后台身份来源；本地开发则允许使用 `.dev.vars` 中的 `ADMIN_DEV_USER_EMAIL`。

### 5. 部署

```bash
pnpm cf:deploy
```

Use these build settings in Cloudflare:

- Build command: `pnpm build`
- Build output directory: `dist`

Worker 入口在 [`worker/index.ts`](/Users/istar/proj/oio/worker/index.ts)，SPA fallback 与 `/api/*` 路由也已经配置在 [`wrangler.toml`](/Users/istar/proj/oio/wrangler.toml)。
