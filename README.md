[➡️ oio.dev](https://oio.15tar.com) - 开发者网址导航

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

## Cloudflare

Use these build settings in Cloudflare:

- Build command: `pnpm build`
- Build output directory: `dist`

SPA routing fallback is configured in [`wrangler.toml`](/Users/istar/proj/oio/wrangler.toml) with `assets.not_found_handling = "single-page-application"`.
