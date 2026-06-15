# P3: フラッシュカード（単語カード）

> 表＝言葉、裏＝意味/例文。タップで裏返し、左右スワイプで「覚えてる/覚えてない」を記録。

- **依存**: P0（review API・対象抽出）
- **領域**: `server` / `webfront`
- **完了でアンロックされるもの**: P4, P6

## 目的

- 各セットの言葉をカードで学習（要件定義「単語カードのビュー」）。
- 表は言葉のみ、タップで裏返し意味/例文/写真。
- 左右スワイプで状態更新:
  - **表でスワイプ**: 単語全体（全 meaning）の状態が変わる。
  - **裏でスワイプ**: 意味（meaning）ごとに状態が変わる。
- 裏面から編集画面へ遷移できる。

## スコープ

### やる
- カードデッキ生成 API（対象: 全て / 覚えてない）。
- スワイプ結果記録 API（`review` を `mode='flashcard'`、`result`=`known`/`unknown`）。
- `word_meaning.isRemembered` の更新、および全 meaning が `isRemembered=true` → `word.isMastered=true` の導出更新。
- Web: スワイプUI（カード裏返し・左右スワイプ・意味単位スワイプ）。

### やらない
- 出題順の忘却曲線最適化（P4。P3 では対象フィルタまで）。
- モバイルのカードUI（P6）。

## データモデル差分

- P0 の `review_log` / `review_state` を利用。
- 既存 `word_meaning.isRemembered` / `word.isMastered` を更新（スキーマ変更なし）。

## API 仕様

| Method | Path | 概要 |
|---|---|---|
| GET | `/cards/:setId?scope=all\|unremembered` | カードデッキ（言葉＋裏面データ＋画像キー）を返す |
| POST | `/cards/:setId/swipe` | スワイプ記録。body: `{ wordId, meaningId?, remembered }`。`meaningId` 無し=単語全体、有り=意味単位 |

- `swipe` は `isRemembered` を更新し、必要に応じ `isMastered` を再計算。`review_log` にも記録。

## 主要UI / 画面

- カード開始（範囲: 全て / 覚えてない）。
- カード（表: 言葉 / タップで裏返し / 裏: 意味・例文・写真）。
- 左右スワイプのジェスチャ（Motion）。表＝全体、裏＝意味ごと。
- 裏面から編集画面への導線。

## タスク（Issue 化）

1. カードデッキ生成サービス（scope フィルタ）＋エンドポイント＋テスト
2. `POST /cards/:setId/swipe`（意味単位/単語単位の状態更新＋isMastered 再計算）＋テスト
3. Web: カードコンポーネント（表裏アニメーション）
4. Web: 左右スワイプ判定（表＝全体 / 裏＝意味単位）と楽観更新
5. Web: 裏面から編集画面への遷移導線

## 完了条件

- セットのカードが表示され、タップで裏返る。
- 表スワイプで単語全体、裏スワイプで意味ごとに状態が更新される。
- 全意味が「覚えた」になると `isMastered` になる。
- 「覚えてない」スコープが機能する。
