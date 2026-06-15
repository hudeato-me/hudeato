---
name: pull-request
description: 作業ツリーの変更を merge-ready な Pull Request にし、CI チェックと AI レビュアー（CodeRabbit）が全て緑になるまで回す。ローカル品質ゲート実行 → PR 作成/更新（このリポジトリの PR 規約準拠）→ レビュー解消ループ。UI 変更は 0.0.0.0:{10000+番号} で起動して動作検証する。「PR を出す」「ship する」「レビューを通す」「レビュー指摘を直す」時に /pull-request で使う。
---

# Pull request: 作成・検証・レビュー通過

現在の変更を、このリポジトリの自動品質ゲートを通る Pull Request にし、レビュー指摘を緑になるまでループで直すエンドツーエンド手順。緑になったらブログ価値のある変更を提案する（Phase 6）。

このリポジトリの品質ゲートは次の2つ:

1. **ローカルゲート**（push 前に自分で回す）: `pnpm typecheck` / `pnpm lint` / `pnpm build`、api 差分があれば `pnpm --filter api test`（vitest）。
2. **CI ＋ AI レビュアー**（PR のステータスチェック＆レビュースレッド）:
   - GitHub Actions の CI（`pnpm typecheck` / `pnpm lint` / `pnpm build` / test）。
   - `CodeRabbit`（`coderabbitai[bot]`）。

「緑」= `gh pr checks` が全て pass **かつ** 上記 bot の未解消レビュースレッドが無い状態。以下のループでそこへ駆動する。bot 集合が変わる場合は `PR_REVIEW_BOTS`（空白区切り）で上書きする。

着手前・実装中の進め方（ブランチ命名・縦スライス・型共有・コミット規約）は CLAUDE.md を参照。

## いつ使うか

- 変更を PR にして merge-ready まで持っていきたいとき。
- 既存のレビュー指摘に対応し、チェックが通るまで push したいとき。
- ユーザ可視（UI）の変更で、動作の裏取りと共に出したいとき。

## 前提（仮定せず確認する）

- `gh auth status` がログイン済み。未ログインなら止めて `gh auth login` を依頼する。
- 作業ツリーの変更がこの PR で意図したものか（`git status` / `git diff`）。
- 動作検証する場合: `scripts/launch-app.sh` が `apps/web`（Vite）/ `apps/api`（wrangler）/ `apps/mobile`（Expo）を起動できること。実装が未着手なら検証はスキップ可（後述）。

ヘルパースクリプトはこのファイルの隣にある:

- `scripts/review-status.sh [PR#]` — CI checks ＋ 未解消 AI レビュースレッドを表示。緑 `0` / ブロック `1` / エラー `2` で exit。
- `scripts/launch-app.sh <番号> [web|api|mobile|both]` — `0.0.0.0:{10000+番号}` でアプリを起動し、起動 URL を表示する。

---

## Phase 1 — ブランチとローカル品質ゲート

1. **`main`（や検出した統合ブランチ）では作業しない。** `git rev-parse --abbrev-ref HEAD` で確認。保護ブランチ上なら先にトピックブランチを切る（`<種別>/<内容>`。例 `git switch -c feat/image-upload`）。
2. ローカルゲートを回し、報告された問題を **push 前に** 全て直す（レビュー往復より安い）:

   ```bash
   pnpm typecheck
   pnpm lint
   pnpm build
   ```

   api 差分（`apps/api/` を含む）があれば:

   ```bash
   pnpm --filter api test
   ```

3. リポジトリ規約（CLAUDE.md）を守る:
   - **型・スキーマは `packages/schema`(zod) を単一の正**とし、api/web/mobile で共有する。手書きの重複型を作らない。
   - 全件取得→フィルタではなく、最初から必要なフィールドのみ取得する。パフォーマンスを著しく落とさない。
   - キャッシュ（Redis / グローバル共通キャッシュ）と非同期ジョブ（Queue→Worker）の境界を `docs/data-flow.md` に沿って守る。AI 出力はキャッシュする。
   - 認証は better-auth 経由。ユーザーデータは必ずログインユーザーにスコープする。

## Phase 2 — 動作検証（UI/挙動が変わる変更のみ）

レイアウト・画面遷移・スワイプ/Haptics・API 応答など、レンダリング/挙動が変わるものは実際に起動して裏を取る。スクリーンショットは不要。代わりに **`0.0.0.0:{10000+番号}` で起動**して確認する（番号は対応 Issue 番号、無ければ PR 番号）。

```bash
# 番号から PORT=10000+番号 を計算し、変更箇所に応じて web/api/mobile/both を自動起動する。
.claude/skills/pull-request/scripts/launch-app.sh <番号>            # 自動判定
.claude/skills/pull-request/scripts/launch-app.sh <番号> web       # 明示指定も可
```

- target を省略すると `git diff --name-only <base>...HEAD` から判定する（`apps/web/` → web、`apps/api/` → api、`apps/mobile/` → mobile、web/api 両方 → both）。
- 起動後、生存確認する: api は `curl -fsS http://0.0.0.0:$PORT/health`、web はトップページ。URL（`http://0.0.0.0:{port}`）をユーザに提示する。
- **実装が未着手**（対象 app が無い設計フェーズ）なら、スクリプトはスキップを表示して正常終了する。その旨を検証欄に書く。
- UI/UX 変更は CLAUDE.md のデザイン原則どおり、余白・整列・アニメ・Haptics・空状態・ローディング・エラー表示まで、自分が使いたくなる仕上がりか確認する。

## Phase 2.5 — ドキュメント/実装 整合性チェック

PR を緑にする過程で、**機能・要件の変更**や、**正本ドキュメントと実装の乖離**を検知したら、このタイミングで整合性を保つよう修正を提案する。Phase 1 合格後・PR 本文確定前に実施する。

突き合わせる正本（CLAUDE.md より）:

- `docs/要件定義.md`（機能仕様）
- `docs/tech-stack.md`（技術選定の意図）
- `docs/infra-architecture.md`（インフラ構成）
- `docs/data-flow.md`（単語取得/登録/クイズ/画像のデータフロー・キャッシュ/Queue 境界）
- `CLAUDE.md`（方針・技術スタック・コマンド・規約）
- `.claude/skills/pull-request`（本スキル）

検知観点の例:

- コマンド／ポート／env 名／エンドポイント名がドキュメント記載と食い違う（例: `/health`、dev コマンド、`wrangler.toml` の bindings）。
- 新規/変更した API・データ項目・型が要件定義や `packages/schema` の単一の正と不整合。
- キャッシュ（Redis / グローバル共通キャッシュ）・Queue→Worker の境界が `docs/data-flow.md` とずれる。
- 認証スコープ（better-auth／ユーザーデータのスコープ）の漏れ、または記述更新が必要な変化。

取り扱い:

- **軽微・明白な事実差**（コマンド名/ポート/リンク等）→ 同じ PR 内でドキュメント/skill も併せて更新し、PR 本文に「ドキュメント整合」節として明記する。
- **設計判断・要件・スキーマ契約・キャッシュ/Queue 境界・認証スコープ**に関わる乖離 → 勝手に変更せず、`AskUserQuestion` で human に確認する（CLAUDE.md「判断に迷ったら human に相談」「公開操作は確認」準拠）。どのドキュメントをどう直すか具体案を提示する。
- 乖離が無ければ何もしない。

## Phase 3 — PR 作成 / 更新

1. 明確なメッセージでコミットして push する:

   ```bash
   git add -A && git commit -m "<日本語・命令形の要約>"
   git push -u origin HEAD
   ```

   コミットメッセージは **日本語・命令形・意味のある単位**（例 `単語・単語セット削除時に画像も削除する`）。push が network エラーで失敗したら指数バックオフ（2s/4s/8s/16s）で最大4回再試行。

2. このブランチの PR が既にあれば（`gh pr view`）、新規作成せず更新する。
3. base ブランチは統合ブランチを検出して使う（`git symbolic-ref --short refs/remotes/origin/HEAD` 由来、既定 `main`）。
4. PR 本文はこのリポジトリの規約に合わせ **概要 / 主な変更 / 動作確認** を書く。対応 Issue があれば `Closes #<n>` を含める。

   ```bash
   BASE=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@'); BASE=${BASE:-main}
   gh pr create --base "$BASE" --title "<タイトル>" --body "$(cat <<'EOF'
   ## 概要
   <何を・なぜ変えたか。1〜2行>

   Closes #<n>

   ## 主な変更
   - <変更点。関連ファイル/コンポーネント名・領域(api/web/mobile/schema)を添える>

   ## 動作確認
   - [x] <起動 URL・/health の結果と確認内容、または N/A>
   - [x] <UI 変更なら見た目・アニメ・触り心地も>

   ## ドキュメント整合
   <併せて更新した docs/skill、または N/A>
   EOF
   )"
   ```

   PR タイトルは内容が分かる簡潔なもの（既存リポジトリに合わせ日本語可）。

## Phase 4 — レビュー解消ループ（緑まで駆動）

`review-status.sh` が `0` で exit するまで繰り返す。**3反復**で打ち切り（Phase 5 参照）。

1. **ゲートが確定するまで待ち**、読む:

   ```bash
   gh pr checks --watch --interval 30      # CI チェックが終わる（or 失敗）までブロック
   .claude/skills/pull-request/scripts/review-status.sh
   ```

   - exit `0` → 緑。「完了」へ。
   - exit `1` → ブロック。出力に失敗チェックと未解消 AI スレッド（`[bot] path:line: コメント`）が並ぶ。続行。
   - exit `2` → 取得エラー（PR 無し / 認証）。解決して再試行。

2. **未解消スレッドを各々その内容に基づいて対応する**:
   - 指摘が正しければコードを直す。関連するローカルゲート（Phase 1）を再実行し lint/test を再び壊さない。
   - 誤検知やスコープ外なら、黙って無視せず根拠をスレッドに返信する: `gh pr comment <PR#> --body "..."`。
   - 実際の修正や明確な正当化なしにスレッドを resolve しない（ゲートを無意味化する）。
3. UI/挙動が変わったら **Phase 2 を再実行**し、起動確認を取り直す。
4. 修正を commit/push（レビュアーが再トリガされる）:

   ```bash
   git add -A && git commit -m "レビュー指摘に対応" && git push
   ```
5. ステップ 1 へ戻る。

## Phase 5 — 完了 or エスカレート

- **緑:** PR が通った旨をユーザに伝える — リンク（`gh pr view --web` の URL）、変更の一行要約、検証内容（UI なら起動 URL）。ユーザが明示的に依頼しない限り merge しない。
- **3反復後も未解消:** ループを止める。残るチェック/スレッド、試したこと、ユーザに必要な判断/権限を簡潔に報告する。投機的修正を push し続けない。

## Phase 6 — ブログ価値？（提案のみ・自動で書かない）

PR が緑で報告済み（Phase 5「緑」）になったら、その変更が記事にする価値のある学びを含むか判断し、**提案する**。記事は書かず、ユーザの go なしに何も作らない。エスカレート時はスキップ。

提案する基準（満たす時のみ）:

- トレードオフのある非自明な**設計判断/アーキテクチャ転換**（例: キャッシュ/Queue 境界の選択、AI 補完の非同期 UX）。
- 根本原因が一般化する**微妙なバグ**。
- ツール/ライブラリ/プラットフォーム挙動についての**驚きの発見**（Cloudflare Workers / TanStack / Expo など）。

ルーチンな機能追加・機械的リファクタ・依存更新・docs のみ・些末な修正では提案しない。提案は1回まで（断られたら以後しない）。基準を満たすなら 1〜2 行のピッチを出し、ブログ issue を切るか尋ねる。

---

## リファレンス

| 用途 | コマンド |
| --- | --- |
| 現在のブランチ | `git rev-parse --abbrev-ref HEAD` |
| ローカルゲート | `pnpm typecheck && pnpm lint && pnpm build`（api は `pnpm --filter api test`） |
| アプリ起動（検証） | `.claude/skills/pull-request/scripts/launch-app.sh <番号> [web\|api\|mobile\|both]` |
| チェック監視 | `gh pr checks --watch --interval 30` |
| ゲート判定 | `.claude/skills/pull-request/scripts/review-status.sh [PR#]` |
| PR レビュースレッド（生） | `gh api repos/{owner}/{repo}/pulls/{n}/comments` |

**ゲート扱いの AI レビュアー bot**: `coderabbitai[bot]`。bot 集合が変わる場合は `PR_REVIEW_BOTS` 環境変数（空白区切り）で上書きする。
