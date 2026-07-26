# AGENTS.md

オーケストラのエキストラ（客演奏者）向け情報ポータル。練習日程・出欠の回答先・ボウイング・練習の録音を1か所に集約し、管理者がブラウザから更新できるようにする。

本番: <https://orch-extras-mgmt.atsu-dq9.workers.dev>

## 最初に読むもの

- `docs/design.md` — 機能仕様、データモデル、認証設計、リンク切れ検知の仕様。**実装の判断はここが正**。決定の一覧は14章
- `docs/tasks.md` — フェーズとタスク、受け入れ条件、現在の進捗
- `docs/adr/` — 実装中に行った設計判断の記録

設計と違う実装が必要になったら、黙って逸脱せず先に相談する。合意して設計を変えたなら `docs/design.md` も更新する。

実装中に設計書に書かれていないことを決めたら、`docs/adr/adr-template.md` を写して ADR を追加し、`docs/design.md` の14章に索引の1行を足す。運用は `docs/adr/0000-use-markdown-architectural-decision-records.md` が正。

## 技術構成

TanStack Start (React + TypeScript) を SPA モードでビルドし、Cloudflare Workers 1つとしてデプロイする。データは D1 (SQLite)、定期実行は Cron Triggers。すべて無料プランの範囲で運用する。選定理由は `docs/design.md` の5章と14章。

- ランタイムは mise で固定（`mise.toml`）。Vite 8 / TypeScript 7 / React 19
- Lint と整形は Biome（`biome.json`）
- 単体テストは Vitest（`src/**/*.test.ts`、node 環境、Start プラグインは読み込まない）
- E2E は Playwright（`e2e/`、モバイル幅）。`E2E_BASE_URL` でデプロイ先にも向けられる
- Worker のエントリは自前の `src/server.ts`（Start の fetch と Cron 用の scheduled を公開）

## コマンド

一覧は `README.md` の「よく使うコマンド」を参照。エージェントが必ず使うのは次のもの。

- 検査: `pnpm lint` / `pnpm typecheck` / `pnpm test`
- `wrangler.jsonc` を変更したら `pnpm cf-typegen` で `worker-configuration.d.ts` を更新する

## 規約

- 書式は Biome に従う。手で整えず `pnpm lint:fix` を使う
- `tsconfig.json` は strict に加えて `noUncheckedIndexedAccess` と `exactOptionalPropertyTypes` を有効にしている。緩めたくなったら相談する
- `verbatimModuleSyntax` は有効にしない。サーバ側のバンドルがクライアントへ混入する恐れがあるため TanStack Start が非推奨としている
- `src/routeTree.gen.ts` と `worker-configuration.d.ts` は生成物。手で編集しない
- コードコメントは、読めば分かることを書かない。設計上の制約や、そう書かなければならない理由だけを書く

## 作業の進め方

1. 着手前にタスク分析と実装方針を示し、合意を得てから実装する
2. タスク単位（T1-1、T1-2 のような粒度）でこまめにコミットする
3. コミット前に `pnpm lint` / `pnpm typecheck` / `pnpm test` を通す
4. ブランチを切って作業し、最後に PR を作る。本文は `.github/pull_request_template.md` の見出しに沿って書く（`gh pr create --body` はテンプレートを読まないので自分で埋める）。main への直接 push は本番デプロイが走るため、ドキュメントのみの変更に限る
5. 構成が変わったら `README.md` を更新する
6. タスクが終わったら `docs/tasks.md` の進捗セクションを更新する

コミットメッセージは日本語で書く。1行目に達成したことを書き、本文には**なぜそうしたか**を書く。何をしたかは差分を見れば分かる。

## 無料プランの制約

`docs/design.md` の5.3が正。実装で特に効くのは次の2点。

- 1リクエストあたりのサブリクエストは50件まで。**D1 クエリも1件として数える**
- CPU 時間は1リクエスト10ms。SSR は行わず、パスワードハッシュに反復型の鍵導出関数を使わない

## 環境上の注意

- コマンドは既定でサンドボックス内で動き、通信先が許可リストに限られる。**ローカルサーバを伴うものはサンドボックス外で実行する**。該当するのは `pnpm build`（SPA シェルの事前生成で自分自身にリクエストするため、サンドボックス内ではハングする）、`pnpm dev`、`pnpm preview`、Playwright
- このマシンでは `node` が asdf の shims に解決されるため、コマンドの前に `export PATH="$HOME/.local/share/mise/shims:$PATH"` を通す
- `PLAYWRIGHT_BROWSERS_PATH` が一時領域を指しているため、Playwright を動かすときは `unset PLAYWRIGHT_BROWSERS_PATH` する
- 開発サーバを止めるときは、pnpm のラッパーではなく実際のリスナを止める（`lsof -t -nP -iTCP:3000 -sTCP:LISTEN`）。ラッパーだけ kill すると子プロセスが残る
- 本番 D1 への操作（`--remote`）とデプロイは影響が及ぶので、実行前に確認を取る
