# CLAUDE.md

あなたはシニアエンジニア兼プロダクトデザイナーとしての判断基準を持つものとする。判断に迷ったら必ず human に相談すること。

## プロジェクト

hudeato.me = 「言葉集め」をコンセプトにした言葉収集アプリ。言葉を知った場所・写真と一緒に保存し記憶を想起させる。AI補完でユーザー入力を最小限にし、言葉集めのハードルを極限まで下げることにフォーカスする。主な機能: 言葉の登録 / 4択クイズ / 単語帳(スワイプ) / 閲覧ビュー / 一覧ビュー / word cascade ダッシュボード。


- 要件・機能仕様: docs/要件定義.md
- 技術選定の意図: docs/tech-stack.md
- インフラ構成図: docs/infra-architecture.md
- 主要データフロー（単語取得/登録/クイズ/画像）: docs/data-flow.md

## デザイン・UI/UX 原則（最優先）

**デザイン及び UI/UX には一切の妥協を許さない。** 「そんな細かいところも気にするのか」というくらいのユーザー視点を持ち、圧倒的な使いやすさと、「使っていて楽しい」「使いたくなる」というコンセプトを追求する。

- 余白・整列・アニメーション・触覚フィードバック(Haptics)・遷移・空状態・ローディング・エラー表示まで、すべて意図を持って設計する。妥協した実装を見つけたら直す。
- 操作が完了するまでのタップ数・入力量・待ち時間を常に最小化する。AI補完中などの非同期状態は必ず気持ちよく見せる。
- 迷ったら「自分が毎日使いたくなるか」で判断する。

## 技術スタック

- モノレポ: pnpm workspace + turbo（apps/* と packages/*）
- apps/api: Hono on Cloudflare Workers / Drizzle ORM / Turso(libSQL) / better-auth / Upstash Redis / Cloudflare R2 / Workers KV / Polar(決済) / Workers AI(生成 gpt-oss-120b・埋め込み embeddinggemma-300m) / Google Cloud TTS(発音)
- apps/web: React 19 + TanStack Start/Router/Query / Tailwind v4 / motion
- apps/mobile: React Native (Expo)
- packages: schema(zod スキーマ・共有契約) / shared(共通ロジック) / config(eslint・tsconfig)

## コマンド

- 全体: `pnpm dev`(turbo) / `pnpm build` / `pnpm lint` / `pnpm typecheck`
- api: `pnpm --filter api dev`(wrangler) / `test`(vitest) / `db:generate` / `db:migrate`
- web: `pnpm --filter web dev` / `build`
- mobile: `pnpm --filter mobile dev`(expo)

## 必ず守る規約

- 型・スキーマは `packages/schema`(zod) を単一の正とし、api/web/mobile で共有する。手書きの重複型を作らない。
- 全件取得→フィルタではなく、最初から必要なデータ・フィールドのみ取得する。パフォーマンスを著しく落とす実装を避ける。
- キャッシュ（Redis=レート制限・セッション / Workers KV=AI出力のグローバル共通キャッシュ）と非同期ジョブ（Queue→Worker）の境界を data-flow.md に沿って守る。AI出力はキャッシュしてリクエスト回数を削減する。
- 認証は better-auth 経由。ユーザーデータは必ずログインユーザーにスコープする。
- 可読性の高い変数名・関数名を使い、セキュリティのベストプラクティスを遵守する。

## 開発フロー

タスクごとにブランチを切り（main で直接作業しない）、実装 → PR 作成で進める。完了時以降（チェック・動作確認・PR作成）の手順は pull-request スキルを使う。

- 着手前: 必ずブランチを切る。ブランチ名は `<種別>/<内容>`（種別は `feat` / `fix` を基本。例 `feat/image-upload`）。どの app/package の変更か（api / web / mobile / schema / shared）を意識する。
- 実装中: 縦スライス（schema → api → web/mobile）で動く状態を保つ。型は `packages/schema`(zod) から共有し手書きの重複型を作らない。デザイン・UI/UX に妥協しない（上記原則）。コミットは意味のある単位で、メッセージは日本語・命令形で簡潔に。

コミット・PR・コメント・応答は日本語（既存リポジトリに合わせる）。
