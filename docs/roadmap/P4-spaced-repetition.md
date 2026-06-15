# P4: 間隔反復（忘却曲線）

> P2/P3 が記録したレビュー結果をもとに**次回出題日を算出**し、クイズ/カードの出題順を忘却曲線に沿わせる。「集める→想起」を「定着」につなげる仕上げ。

- **依存**: P2, P3（`review_log` にデータが溜まる）
- **領域**: `server` / `webfront`
- **完了でアンロックされるもの**: P6, P7

## 目的

- レビュー結果（正誤/known・unknown）から `review_state`（interval / ease / next_review_at）を更新するアルゴリズムを実装。
- クイズ・カードの出題順を `next_review_at` 昇順（期限切れ優先）に。
- カードは「各意味の next_review_at のうち最も近い日」を単語の次回出題日とする（要件定義）。
- ダッシュボードに「今日の復習対象数」を表示。

## スコープ

### やる
- 間隔反復アルゴリズム（SM-2 ベースを基準、係数は調整可能に）。
- `review` 記録時に `review_state` を更新する処理を P0 のエンドポイントへ統合。
- 出題対象抽出を「期限到来（next_review_at <= now）優先」に拡張。
- 単語の次回出題日 = 配下 meaning の最小 next_review_at の導出。
- ダッシュボードの復習対象サマリ。

### やらない
- 機械学習ベースの個別最適化（v1 後）。
- モバイル反映（P6）。

## データモデル差分

- P0 で用意した `review_state`（next_review_at / interval_days / ease_factor / reps / lapses）を本フェーズで実利用。
- 追加変更は原則なし。必要なら meaning 単位の状態が要るか検討（カードが意味単位のため、`review_state` を meaning 粒度に拡張する選択肢をタスクで判断）。

## API 仕様

| Method | Path | 概要 |
|---|---|---|
| POST | `/study/:setId/review` | P0 の記録処理に**スケジュール更新**を追加（interval/ease/next_review_at 算出） |
| GET | `/study/:setId/due` | 期限到来の出題対象（クイズ/カード共通の「今やるべき」リスト） |
| GET | `/dashboard/summary` | 既存に「今日の復習対象数」を追加 |

- クイズ `GET /quiz/:setId` / カード `GET /cards/:setId` の出題順を `due` ベースに切替（scope に `due` を追加）。

## 主要UI / 画面

- クイズ/カードの開始画面に「今日の復習（N件）」導線。
- ダッシュボードに復習対象数・次回復習までの可視化。

## タスク（Issue 化）

1. 間隔反復アルゴリズム（SM-2 ベース）実装＋単体テスト（境界: 初回/連続正解/忘却）
2. `review` 記録時の `review_state` 更新統合
3. `review_state` の粒度判断（単語 or 意味単位）と必要ならマイグレーション
4. `GET /study/:setId/due` と、クイズ/カードへの `scope=due` 追加
5. 単語の次回出題日 = 配下 meaning の最小値 の導出ロジック
6. ダッシュボードに「今日の復習対象数」を追加（API＋Web）

## 完了条件

- 正誤/known・unknown に応じて next_review_at が前後する（正解で延伸、忘却で短縮）。
- クイズ/カードが期限到来順に出題できる。
- ダッシュボードに今日の復習対象数が出る。
- アルゴリズムが単体テストでカバーされている。
