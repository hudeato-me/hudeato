# P5: 課金（Polar）

> 無料/有料の線引きと決済導線。Polar SDK（tech-stack に採用済み）で実装。AI補完など原価のかかる機能をプランで制御する。

- **依存**: P0（認証・ユーザー基盤）。機能ゲートのため P1〜P4 と並行可能
- **領域**: `server` / `webfront`
- **完了でアンロックされるもの**: P6, P7

## 目的

- 無料プランと有料プランを定義し、決済（サブスク）を導入。
- AI補完回数・セット数・単語数などの**プラン別リミット**を適用。
- 課金状態に応じた機能ゲート（UI/APIの両方）。

## スコープ

### やる
- Polar 連携（チェックアウト・サブスク状態取得・Webhook）。
- プラン定義とエンタイトルメント（無料/有料の機能・上限）。
- API 側のリミット適用（AI補完回数・セット/単語上限など）。
- Web: 料金ページ・アップグレード導線・現在のプラン表示。
- 課金状態の永続化と Redis キャッシュ。

### やらない
- 複数通貨・年額/月額の細かい最適化（v1 は最小プラン構成）。
- モバイルのアプリ内課金（P6 で判断。Web 決済に寄せる方針を基本とする）。

## データモデル差分

```
// 課金/サブスク状態（Polar の顧客・サブスクと対応づけ）
subscription
  user_id           FK -> user.id (cascade)  unique
  polar_customer_id text
  plan              text   // 'free' | 'pro'
  status            text   // 'active' | 'canceled' | 'past_due' ...
  current_period_end timestamp_ms
  created_at / updated_at
```

- エンタイトルメント（上限値）はコード定義 or 設定テーブル。MVP はコード定義で可。

## API 仕様

| Method | Path | 概要 |
|---|---|---|
| POST | `/billing/checkout` | Polar チェックアウトセッション作成、URL を返す |
| POST | `/billing/webhook` | Polar Webhook 受信、`subscription` を更新 |
| GET | `/billing/me` | 現在のプラン・上限・使用量を返す |

- リミット適用は既存のレート制限ユーティリティ（`apps/api/src/utils`）に倣ってミドルウェア化。

## 主要UI / 画面

- 料金/プランページ。
- アップグレード導線（リミット到達時のモーダル含む）。
- 設定画面に現在のプラン表示・管理（解約は Polar ポータルへ）。

## タスク（Issue 化）

1. プラン定義とエンタイトルメント（無料/有料の上限）設計
2. `subscription` スキーマ＋マイグレーション
3. Polar 連携（checkout / customer portal）実装
4. `POST /billing/webhook` でサブスク状態同期＋Redis キャッシュ
5. API リミット適用ミドルウェア（AI補完回数・セット/単語上限）
6. `GET /billing/me`（プラン・上限・使用量）
7. Web: 料金ページ＋アップグレード導線＋プラン表示

## 完了条件

- 無料→有料のチェックアウトが通り、Webhook で状態が同期される。
- 無料プランの上限到達時にゲート（API 拒否＋UI 誘導）が機能する。
- 設定画面で現在のプランが確認できる。
