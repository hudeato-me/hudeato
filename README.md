
## ディレクトリ構成

### 全体

```bash
> % tree -D
 .
├──  .turbo
│   ├──  cookies
│   └──  daemon
├──  apps
│   ├──  api
│   ├──  mobile
│   └──  web
├──  docs
├──  node_modules
│   ├──  .bin
│   ├──  .pnpm
│   ├──  @eslint
│   └──  @eslint-community
└──  packages
    ├──  config
    ├──  schema
    └──  shared
```

### apps/api
```bash
routes/                 # ルート登録
      index.ts
      users.ts
      auth.ts
      billing.ts
      ai.ts

    modules/                # ドメイン単位の実装（ビジネスロジック）
      user/
        service.ts
        repository.ts
      auth/
        service.ts
      billing/
        service.ts
      ai/
        service.ts
```
