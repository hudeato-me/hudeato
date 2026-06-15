---
name: pull-request
description: hudeato.me の完了時以降の手順（チェック → 動作確認 → PR 作成）。実装が一段落して PR を作るとき、変更をレビューに出すときに使う。着手前・実装中の進め方は CLAUDE.md を参照。
---

# Pull Request

実装が一段落してから PR を出すまでの標準手順。着手前・実装中の進め方は CLAUDE.md を参照。

## 1. チェック・動作確認

- ローカルのチェックを通す: `pnpm typecheck` / `pnpm lint`、関連があれば `pnpm --filter api test` / `pnpm build`。
- 実機・ブラウザで動作確認する。UI 変更は余白・アニメ・Haptics・空状態・ローディングまで、自分が使いたくなる仕上がりか確認する（CLAUDE.md のデザイン原則）。

## 2. PR 作成

- `gh pr create` で PR を作成する。本文には目的・主な変更・動作確認を書く。対応 Issue があれば PR 説明に `Closes #<n>` を含めてクローズする。
- マージは GitHub 上の PR 経由で行う（`Merge pull request #...`）。

## 注意

- 判断に迷ったら必ず human に相談する。特に DB マイグレーション・API 互換性・認証/決済まわりは慎重に。
- PR は human が明示的に依頼した場合に作成する。勝手に外部へ公開する操作は確認を取る。
