---
name: pull-request
description: hudeato.me の完了時以降の手順（チェック → 動作確認 → Pull Request 作成）。実装が一段落して PR を作るとき、変更をレビューに出すときに使う。着手前・実装中の進め方は CLAUDE.md を参照。
---

# Pull Request

実装が一段落してから PR を出すまでの手順。コミット・PR・コメントはすべて日本語。
（ブランチ作成など着手前・実装中の進め方は CLAUDE.md を参照）

## 1. PR を出す前

- チェックを通す: `pnpm typecheck` / `pnpm lint`、関連があれば `pnpm --filter api test`、`pnpm build`。
- 実機・ブラウザで動作を確認する。UI 変更は特に、自分が使いたくなる仕上がりか確認する（CLAUDE.md のデザイン原則）。

## 2. PR 作成

PR は **human が明示的に依頼した場合に作成する**（勝手に外部公開しない）。`gh pr create` を使い、本文は下記テンプレートに従う。対応 Issue があれば `Closes #<n>` で閉じる。

```markdown
## 概要
<何を・なぜ。1〜2行>

## 主な変更
- <変更点を箇条書き。関連ファイルやコンポーネント名を添える>
- <api / web / mobile / schema など領域が分かると良い>

## 動作確認
- [x] <実際に試した操作と結果>
- [x] <UI 変更なら見た目・アニメ・触り心地も>
```

例（PR #14 より）:

```markdown
## 概要
単語セットごとに入力欄をカスタマイズできる設定モーダルを追加。あわせて触覚フィードバック(Haptics) も実装した。

## 主な変更
- 単語セット設定モーダル `WordSetSettingsModal`（入力欄の表示切替・ドラッグ並び替え）
- バックエンド: `wordSets.settings` カラム追加 (`migrations/0003_swift_khan.sql`)
- 単語セット更新APIを PUT ひとつに統合

## 動作確認
- [x] セット名タップ → 設定 → モーダルが開く
- [x] 入力欄を非表示にすると登録ドロワー側でも消える
- [x] スマホ実機で各操作に振動が出る
```

## 注意

- 判断に迷ったら必ず human に相談する。特に DB マイグレーション・API 互換性・認証/決済まわりは慎重に。
- マージは GitHub 上の PR 経由で行う（`Merge pull request #...`）。
