# P1: AI補完

> 「言葉集めのハードルを極限まで下げる」中核機能。空欄を AI が補完し、ユーザー入力を最小化する。AI が生成する意味・例文の品質は後続のクイズ/カードに直結する。

> **注記（2026-07）**: 本書の Gemini / Upstash Redis 前提は実装完了後に **Workers AI（gpt-oss-120b / embeddinggemma-300m）＋ Workers KV** へ移行済み。現行構成は `docs/tech-stack.md`・`docs/data-flow.md` が正。以下は計画当時の記録。

- **依存**: P0
- **領域**: `ai` / `server` / `webfront`
- **完了でアンロックされるもの**: P2（高品質ディストラクタ）, P6

## 目的

- AI補完のボタンをタップした時、**テキスト未入力の欄だけ** AI が補完する（入力済みの欄は触らない）。
- 補完時にプロンプトを入力できるようにする（入力欄を設けるなど）
- 補完は**非同期**で進行（一覧に戻ってから "補完中→完了" 表示）。
- 良く登録される語は**共有キャッシュ**でAI呼び出しを削減（`data-flow.md` 参照）。
- AIチャット欄の入力を補完のコンテキストに反映。

## スコープ

### やる
- 単語登録 API に補完ステータス（`pending` / `done`）を持たせ、空欄補完を非同期実行。
- Gemini 3.5 Flash 連携モジュール（意味・品詞・発音記号・例文・コロケーション・類語・語源）。
- 共有キャッシュ（Upstash Redis、`global:meaning:{word}:{lang}`）の読み書き。
- 補完完了後に `word_embedding` を生成（P2 の近傍検索の入力）。
- Web 側: 「AI補完中」表示と完了反映（ポーリング or 再フェッチ）。
- AIチャット欄をコンテキストとして渡す補完。
- 編集画面の `send`（画面を閉じずに対象欄を補完中表示→補完）。

### やらない
- クイズ/カードの利用（P2/P3）。
- モバイルの補完UI（P6）。

## データモデル差分

```
// word に補完ステータスを追加
word
  + completion_status text default 'done'  // 'pending' | 'done' | 'failed'

// 既存 word_meaning の各列（meaning/part_of_speech/phonetic/example/
// collocation/synonym/etymology/source）を AI 出力先として利用（スキーマ変更なし）
```

> 非同期処理基盤: Cloudflare Workers の構成に合わせ、`waitUntil` / Queues / Cron のいずれか（後述タスクで選定）。

## API 仕様

| Method | Path | 概要 |
|---|---|---|
| POST | `/words/:setId` | 既存を拡張。空欄があり補完ONなら `completion_status='pending'` で即時 201、裏で補完 |
| GET | `/words/:setId/:wordId` | 既存。`completion_status` を含めて返す（Web のポーリング先） |
| POST | `/words/:setId/:wordId/complete` | AIチャット文を受けて任意項目を再補完（編集画面の `send`） |

- 補完リクエスト/レスポンスの Zod を `packages/schema` に追加。
- Gemini 呼び出しは構造化出力（JSON）で受け、`word_meaning` の各 slot にマッピング。

## 主要UI / 画面

- 登録ドロワー（`WordEntryDrawer.tsx`）: 補完ON時、登録後に一覧へ戻り「補完中」バッジ→完了で解除。
- 編集画面: 常時編集（Notion-like）＋ AIチャット欄 `send` で対象欄を補完中表示→反映。
- 補完失敗時のリトライ導線。

## タスク（Issue 化）

1. Gemini 連携モジュール（構造化出力・プロンプト設計・リトライ）実装＋テスト
2. `word.completion_status` 追加とマイグレーション
3. 非同期実行基盤の選定と実装（waitUntil / Queues / Cron）＋空欄のみ補完するロジック
4. 共有キャッシュ（Redis `global:meaning:*`）の読み書き＋ヒット時はAIスキップ
5. 補完完了後の `word_embedding` 生成フック
6. `POST /words/:setId/:wordId/complete`（チャット文脈つき再補完）実装＋テスト
7. Web: 登録ドロワーの補完中→完了 表示とポーリング/再フェッチ
8. Web: 編集画面の `send` による対象欄補完UI

## 完了条件

- 空欄ありで登録すると即時に一覧へ戻り、補完中表示の後に意味/例文等が反映される。
- 既存語はキャッシュからAI呼び出しなしで補完される。
- 補完完了語に `word_embedding` が生成される。
- 編集画面の `send` が対象欄だけを補完する。
