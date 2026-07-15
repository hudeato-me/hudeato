# memo
## DB & Auth
- リージョンをtokyoにしたら速度も問題なさそう．

- turso
  - チームプランはお金がかかるので，開発時はローカルのsqliteを使う．
  - デプロイするときとかテストの時に本番を使う
- better auth

### orm

-  drizzle

### in memory db

- upstash (redis)
  - キャッシュやレート制限の管理

### storage

- cloudflare r2
  - 画像とか保存する

## server

- hono on cloudflare workers

## ai

- cloudflare workers ai に決定（2026-07: gemini から移行）
  - 意味生成: `@cf/openai/gpt-oss-120b`（Responses API 形式・json_schema 構造化出力）
  - 埋め込み: `@cf/google/embeddinggemma-300m`（768次元・Turso Vector のスキーマと互換）
  - バインディング注入なので外部APIキー不要。ローカル開発は wrangler が実リソースにプロキシする
    （複数アカウント環境では `CLOUDFLARE_ACCOUNT_ID` の指定が必要）
- AI出力の共有キャッシュは workers kv（`global:meaning:{word}:{lang}`, TTL 30日）
- upstash redis はレート制限・認証セッション用に残す

## webfront

- react on cloudflare workers
- tanstack start
- joyai

## mobile
- react nativeのコンポーネントライブラリ選定

## 決済

- polarをつかう
- betterauthにプラグインがある
