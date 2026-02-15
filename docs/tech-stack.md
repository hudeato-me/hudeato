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

- cloudflare workers aiのoss llmか、gemini2.5 flash lite
- cloudflare workers aiとかkvを使ってうまくキャッシュする
- いい感じに実装して速度を追求したい

## webfront

- react on cloudflare workers
- tanstack start
- joyai

## mobile
- react nativeのコンポーネントライブラリ選定

## 決済

- polarをつかう
- betterauthにプラグインがある
