# P0: 基盤整備

> 学習機能（クイズ/カード/間隔反復）が共有する**データモデルと共通API土台**を先に固める。後続フェーズの手戻りを最小化するための土台フェーズ。

- **依存**: なし
- **領域**: `server` / `infra`
- **完了でアンロックされるもの**: P1〜P5 すべて

## 目的

- 既存スキーマ（`word.isMastered` / `word.lastReviewedAt` / `word_meaning.isRemembered` / `slot`）を起点に、**レビュー状態・履歴・ベクトル埋め込み**を表現できるデータモデルを定義する。
- クイズ・カードが叩く**学習系APIの共通土台**（出題対象の抽出ロジック、レビュー記録のエンドポイント設計）を用意する。
- テスト / マイグレーション / CI を整え、後続フェーズが安全に積み上げられる状態にする。

## スコープ

### やる
- 学習用スキーマの追加（下記「データモデル差分」）と Drizzle マイグレーション。
- 出題対象抽出の共通クエリ（「全ての言葉」「未正解/未習得の言葉」）。
- レビュー記録の共通エンドポイント設計（クイズ/カードが共用）。
- Turso Vector の埋め込み列・近傍検索の疎通確認（実生成は P1、検索利用は P2）。
- API テスト基盤（Vitest）の整備と CI（GitHub Actions）での自動実行。

### やらない
- AI による意味生成そのもの（P1）。
- クイズ出題・採点ロジック本体（P2）。
- 忘却曲線アルゴリズムの本実装（P4）。スキーマの器だけ用意する。

## データモデル差分

新規/変更（`apps/api/src/db/word-schema.ts`）。

```
// 新規: 単語ごとのレビュー状態（間隔反復のスケジューリング器）
review_state
  word_id        FK -> word.id (cascade)   PK か unique
  next_review_at timestamp_ms  (nullable)  // 次回出題日
  interval_days  integer       default 0   // 現在の間隔
  ease_factor    real          default 2.5 // 難易度係数（SM-2系）
  reps           integer       default 0   // 連続正解回数
  lapses         integer       default 0   // 忘却回数
  created_at / updated_at

// 新規: レビュー履歴（正誤・モード別の記録、分析と忘却曲線の入力）
review_log
  id             PK
  word_id        FK -> word.id (cascade)
  meaning_id     FK -> word_meaning.id (nullable) // カードは意味ごと
  mode           text  // 'quiz' | 'flashcard'
  result         text  // 'correct' | 'wrong' | 'known' | 'unknown'
  reviewed_at    timestamp_ms

// 新規: 単語のベクトル埋め込み（クイズのディストラクタ近傍検索用）
word_embedding
  word_id        FK -> word.id (cascade)  PK
  embedding      F32_BLOB(次元数)          // Turso Vector
  model          text                     // 生成モデル名
  updated_at
```

> 既存の `word.lastReviewedAt` / `word.isMastered` / `word_meaning.isRemembered` は維持。`isMastered` は「全 meaning が `isRemembered=true`」で導出する既存ルールを踏襲（`word-schema.ts` のコメント参照）。

## API 仕様（土台）

| Method | Path | 概要 |
|---|---|---|
| GET | `/study/:setId/targets?mode=all\|unmastered` | 出題対象の単語ID群を抽出（クイズ/カード共用の基礎クエリ） |
| POST | `/study/:setId/review` | レビュー結果を記録（`review_log` 追記＋`review_state` 更新）。body: `{ wordId, meaningId?, mode, result }` |

- レスポンス/リクエストは Zod で定義。`packages/schema` に学習系スキーマを追加。
- 認可は既存ミドルウェア（Better Auth）に倣い、`userId` スコープで絞る。

## 主要UI / 画面

- このフェーズに新規画面は無し（土台）。既存 `apps/web` のフックに学習APIクライアントの雛形（`use-study.ts`）だけ用意。

## タスク（Issue 化）

1. `review_state` / `review_log` / `word_embedding` スキーマ追加と Drizzle マイグレーション生成・適用
2. `packages/schema` に学習系 Zod スキーマ（targets / review）を追加
3. 出題対象抽出クエリ（all / unmastered）の repository 実装＋単体テスト
4. `POST /study/:setId/review`（履歴記録＋状態更新の最小版）実装＋テスト
5. `GET /study/:setId/targets` 実装＋テスト
6. Turso Vector の列定義と近傍検索クエリの疎通確認（ダミーベクトルで挿入・検索）
7. CI（GitHub Actions）で `vitest` と型チェック・lint を自動実行する workflow 追加

## 完了条件

- 新スキーマがマイグレーション適用済みで、`/study/:setId/targets` と `/study/:setId/review` がテスト付きで動作する。
- ベクトル近傍検索がダミーデータで成立することを確認済み。
- CI で API テスト・型チェック・lint がグリーン。
