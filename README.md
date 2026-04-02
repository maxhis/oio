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
TELEGRAM_BOT_TOKEN=123456:example-token
TELEGRAM_CHAT_ID=123456789
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
公开投稿接口 `/api/submissions` 会读取 `.dev.vars` 或 Cloudflare secrets/vars 中的 `TELEGRAM_BOT_TOKEN` 与 `TELEGRAM_CHAT_ID`，将用户填写的网站、简介和联系方式转发到 Telegram。
投稿接口还会使用 D1 中的 `submission_attempts` 表做基础频控，因此拉取新代码后需要一并执行 migration。

### 5. 部署

```bash
pnpm cf:deploy
```

生产环境必须通过 `wrangler deploy` 发布 Worker，不能只把 `dist` 当成纯静态站点部署；否则 `/api/submissions` 这类 `POST` 接口会落到 Cloudflare 静态资产层，直接返回 `405 Method Not Allowed`。

部署时需要保留 Cloudflare Dashboard 上已有的普通 `vars`，否则 Wrangler 会先删除远端 `vars` 再应用本地配置。当前仓库里的 `pnpm cf:deploy` 已经默认带上 `--keep-vars`。

`TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID` 这类线上必需值，建议统一使用 `wrangler secret put` 维护。secret 不会因为普通部署被删除，比放在 Dashboard 的普通 `vars` 更稳妥。

当前 [`wrangler.toml`](/Users/istar/proj/oio/wrangler.toml) 已经把这些生产路径显式绑定到 Worker：

- `oio.15tar.com/api/*`
- `oio.15tar.com/admin`
- `oio.15tar.com/admin/*`

如果你之前是按 Pages-only 的方式部署，修复步骤就是重新执行一次 `pnpm cf:deploy`，让域名路由更新到 Worker。

Worker 入口在 [`worker/index.ts`](/Users/istar/proj/oio/worker/index.ts)，SPA fallback 与 `/api/*` 的静态资源协同规则也已经配置在 [`wrangler.toml`](/Users/istar/proj/oio/wrangler.toml)。

### 6. Cloudflare Git 自动部署

这个项目可以直接使用 Cloudflare Workers 自带的 Git 自动部署，不依赖 GitHub Actions。

推荐的 Cloudflare Build 配置：

- Build command: `pnpm build`
- Deploy command: `pnpm cf:deploy`
- Root directory: `/`
- Production branch: `master`

注意不要继续使用默认的 `npx wrangler deploy`。当前仓库的 [`package.json`](/Users/istar/proj/oio/package.json) 里，`pnpm cf:deploy` 已经带了 `--keep-vars`，可以避免部署时把 Dashboard 上已有的普通 `vars` 清掉。

如果你把 Git 自动部署接到了 Cloudflare，那么正常情况下只要 push 到生产分支，就会自动 build 并部署 Worker。

但有一个例外：D1 migration 不会自动跟着代码部署执行。只要本次改动新增了 migration 文件，就需要先手动运行：

```bash
pnpm cf:d1:migrate:remote
```

再让 Cloudflare 继续部署最新代码，或者手动补一次：

```bash
pnpm cf:deploy
```

另外，Cloudflare Build 页面里的 “Variables and secrets” 只用于构建阶段，不等同于 Worker 运行时变量。像 `TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID` 这类线上运行必需值，仍然建议在 Worker 的运行时 Variables / Secrets 里维护。
