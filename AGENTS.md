# AGENTS.md

オーケストラのエキストラ（客演奏者）向け情報ポータル。練習日程・出欠の回答先・ボウイング・練習の録音を1か所に集約し、管理者がブラウザから更新できるようにする。

本番: <https://orch-extras-mgmt.atsu-dq9.workers.dev>

## 最初に読むもの

- `docs/README.md` — 文書の索引と「正」の場所
- `docs/platform/design.md` — 横断仕様（技術基盤、認証、無料枠、CI、ADR 索引）。**基盤の実装判断はここが正**
- 作業対象の `docs/<feature>/design.md` と `docs/<feature>/tasks.md` — 機能仕様・タスク・進捗。**機能の実装判断はここが正**
- `docs/adr/` — 実装中に行った設計判断の記録
- `docs/archive/initial/` — 初回リリース〜Phase 10 の総合設計・タスク（**凍結参照**。実装判断の正ではない。編集せず、変えるときは platform / 機能 design へ移す）

設計と違う実装が必要になったら、黙って逸脱せず先に相談する。合意して設計を変えたなら、対象の `docs/<feature>/design.md` または `docs/platform/design.md` を更新する。

実装中に設計書に書かれていないことを決めたら、`docs/adr/adr-template.md` を写して ADR を追加し、`docs/platform/design.md` の決定索引に1行を足す。運用は `docs/adr/0000-use-markdown-architectural-decision-records.md` が正。

新機能は `docs/<feature>/` に `design.md` と `tasks.md` を置いてから実装する。`docs/superpowers/` への新規仕様書・計画書は作らない。

## 技術構成

TanStack Start (React + TypeScript) を SPA モードでビルドし、Cloudflare Workers 1つとしてデプロイする。データは D1 (SQLite) に置き、定期実行基盤は持たない。すべて無料プランの範囲で運用する。選定理由は `docs/platform/design.md`。

- ランタイムは mise で固定（`mise.toml`）。Vite 8 / TypeScript 7 / React 19
- Lint と整形は Biome（`biome.json`）
- 単体テストは Vitest（`src/**/*.test.ts` / `src/**/*.test.tsx`、node 環境、Start プラグインは読み込まない）
- E2E は Playwright（`e2e/`、モバイル幅）。`E2E_BASE_URL` でデプロイ先にも向けられる
- Worker のエントリは自前の `src/server.ts`（Start の fetch をラップして公開）

## コマンド

一覧は `README.md` の「よく使うコマンド」を参照。エージェントが必ず使うのは次のもの。

- 検査: `pnpm lint` / `pnpm typecheck` / `pnpm test`
- `wrangler.jsonc` を変更したら `pnpm cf-typegen` で `worker-configuration.d.ts` を更新する

## 規約

- 書式は Biome に従う。手で整えず `pnpm lint:fix` を使う
- `tsconfig.json` は strict に加えて `noUncheckedIndexedAccess` と `exactOptionalPropertyTypes` を有効にしている。緩めたくなったら相談する
- `verbatimModuleSyntax` は有効にしない。サーバ側のバンドルがクライアントへ混入する恐れがあるため TanStack Start が非推奨としている
- 画面（コンポーネント本体）から `src/db/schema.ts` や、それを読むサーバ専用モジュールの値を直接・間接に参照しない。読むだけで drizzle がクライアントのバンドルに載る。画面にも出す定数・型は `src/lib/` に置き、スキーマやサーバ側がそれを読む（`src/lib/limits.ts`、`src/lib/roles.ts`）。サーバ関数の `.validator()` や `.handler()` の中だけで使う import は、ビルド時に落ちるので構わない
- `src/routes/` 配下にテストを置く場合、TanStack Router のルート走査から外すためファイル名を `-` で始める
- 選択中の演奏会に属するフォーム state を追加したら、演奏会切り替えで初期化し、別演奏会へ値が残らない回帰テストを書く
- `src/routeTree.gen.ts` と `worker-configuration.d.ts` は生成物。手で編集しない
- コードコメントは、読めば分かることを書かない。設計上の制約や、そう書かなければならない理由だけを書く

## 作業の進め方

1. 着手前にタスク分析と実装方針を示し、合意を得てから実装する。フェーズ全体を頼まれた場合はフェーズ単位の合意1回にまとめ、「最後まで進めて」と指示された後は設計変更・破壊的操作・外部作業が必要にならない限り、節やタスクごとの再承認を挟まない
2. タスク単位（T1、T2 や旧来の T1-1 のような粒度）でこまめにコミットする
3. コミット前に `pnpm lint` / `pnpm typecheck` / `pnpm test` を通す。Subagent が同じ差分で通した直後ならその結果を使い、親 Agent が重ねて全検査を実行しない。差分が変わった場合とフェーズ最終確認では親 Agent が再実行する
4. ブランチを切って作業し、最後に PR を作る。フェーズ実装は原則1ブランチ・1PRとする。明示依頼がなければ `docs/superpowers/` の仕様書・計画書を作らない（機能の design/tasks で足りる）。本文は `.github/pull_request_template.md` の見出しに沿って書く（`gh pr create --body` はテンプレートを読まないので自分で埋める）。main への直接 push は本番デプロイが走るため、ドキュメントのみの変更に限る
5. 構成が変わったら `README.md` を更新する
6. タスクが終わったら対象機能の `docs/<feature>/tasks.md` の進捗を更新する
7. 機能を見送る設計変更では、完了前に旧機能名をコード・設定・文書から横断検索し、意図した履歴記述以外を除去する

コミットメッセージは日本語で書く。1行目に達成したことを書き、本文には**なぜそうしたか**を書く。何をしたかは差分を見れば分かる。

## 無料プランの制約

`docs/platform/design.md` の無料プラン節が正。実装で特に効くのは次の2点。

- 1リクエストあたりのサブリクエストは50件まで。**D1 クエリも1件として数える**
- CPU 時間は1リクエスト10ms。SSR は行わず、パスワードハッシュに反復型の鍵導出関数を使わない

## 環境上の注意

- コマンドは既定でサンドボックス内で動き、通信先が許可リストに限られる。**ローカルサーバを伴うものはサンドボックス外で実行する**。該当するのは `pnpm build`（SPA シェルの事前生成で自分自身にリクエストするため、サンドボックス内ではハングする）、`pnpm dev`、`pnpm preview`、Playwright
- このマシンでは `node` が asdf の shims に解決されるため、コマンドの前に `export PATH="$HOME/.local/share/mise/shims:$PATH"` を通す
- `PLAYWRIGHT_BROWSERS_PATH` が一時領域を指しているため、Playwright を動かすときは `unset PLAYWRIGHT_BROWSERS_PATH` する
- 開発サーバを止めるときは、pnpm のラッパーではなく実際のリスナを止める（`lsof -t -nP -iTCP:3000 -sTCP:LISTEN`）。ラッパーだけ kill すると子プロセスが残る
- 本番 D1 への操作（`--remote`）とデプロイは影響が及ぶので、実行前に確認を取る

## Cursor Cloud specific instructions

この節は Cursor Cloud のVM向け。上の「環境上の注意」は mise/asdf を使うローカル開発機の話で、Cloud VM には当てはまらない。

- ランタイムは mise ではなく nvm で入れた Node 24.18.0。`/usr/local/cargo/bin`（PATH の先頭）に `node`/`pnpm` 等の symlink を張ってあるので、`export PATH=...` の小細工なしで `node`/`pnpm` は v24 に解決される（symlink が無いと `/exec-daemon/node` の v22 が優先されるので、壊れていたら `ln -sf $HOME/.nvm/versions/node/v24.18.0/bin/{node,pnpm,npm,npx,corepack} /usr/local/cargo/bin/` で復旧する）
- 依存の更新は起動時の update script（`pnpm install`）が済ませる。作業開始時に `.dev.vars` とローカル D1（`.wrangler/state`）の有無を確認し、消えていたら `cp .dev.vars.example .dev.vars` → `pnpm db:migrate` → `pnpm db:seed` で作り直す。スキーマを変えたら `pnpm db:migrate` を流す
- 検査（`pnpm lint` / `pnpm typecheck` / `pnpm test`）と開発サーバ（`pnpm dev`、http://localhost:3000）はこのVMではサンドボックスの制約なくそのまま実行できる。上の「環境上の注意」のサンドボックス回避は不要
- ローカルログインの共有パスワードは `.dev.vars.example` の既定値（管理者 `local-admin-password` / エキストラ `local-extra-password`）。`pnpm db:seed` がこれを投入する
- E2E（Playwright）を動かすなら初回のみ `pnpm exec playwright install chromium`

### Cloud Agent と Subagent の実行

- 共有ワークスペースを変更する Subagent は同時に1件だけ起動する。完了を確認できないまま同じタスクを再起動しない。`aborted` や中断を受け取ったら、まず `git status` と UI 上の状態を確認する
- Subagent には commit・push・PR操作をさせず、戻った直後に親 Agent が作業ツリーと `git log` を確認する。予期しないcommitがあれば先へ進む前に内容を確認する
- フェーズタスクでは各小タスクへ仕様レビューと品質レビューを二重に付けない。DB・認証・マイグレーションなど高リスク部分だけ追加レビューし、全体の仕様・品質レビューをフェーズ末に1回ずつ行う
- 停止要求を受けたら新しい Subagent やコマンドを起動しない。確認手段がない状態で「全て停止済み」と断言せず、確認できた範囲と UI 側で必要な操作を伝える
- 画面録画は操作準備を終えてから開始し、成功確認の直後に保存する。長い待機や別作業を録画中に挟まない
