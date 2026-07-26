# orch-extras-mgmt

オーケストラのエキストラ（客演奏者）向け情報ポータル。練習日程と出欠の回答先、ボウイング、練習の録音を1か所にまとめて公開し、管理者がブラウザから更新できるようにする。

現在の状態: **Phase 1 完了（データ基盤）**。9テーブルのスキーマと初期投入までできている。画面はまだプレースホルダのみ。

本番: <https://orch-extras-mgmt.atsu-dq9.workers.dev>

## ドキュメント

- [設計書](docs/design.md) — 機能仕様、データモデル、認証設計、リンク切れ検知の仕様。決定の一覧は14章
- [タスク一覧](docs/tasks.md) — リリースまでの作業とフェーズ、受け入れ条件
- [ADR](docs/adr/) — 実装中に行った設計判断の記録（[MADR](https://adr.github.io/madr/) の minimal 版）

## 機能の概要

- 練習日程の一覧（日付・時刻・会場・フリーテキストの詳細）
- 出欠回答先（外部サービス）へのリンク
- 練習ごとの録音・録画リンク
- 曲ごとのボウイングリンク
- ボウイングリンクの死活を毎日自動チェックし、状態が変わったら Slack に通知
- 演奏会単位の管理と切り替え
- 管理者は更新可、エキストラは参照のみ。個人情報は保持せず、ロールごとの共有パスワードで認証する

## 技術構成

TanStack Start (React + TypeScript) を SPA モードでビルドし、Cloudflare Workers 1つとしてデプロイする。データは Cloudflare D1 (SQLite) に置き、定期実行は Cloudflare Cron Triggers を使う。いずれも無料プランの範囲内で運用する。

詳細と選定理由は[設計書](docs/design.md)の5章および14章を参照。

## 開発の始め方

Node と pnpm のバージョンは [mise](https://mise.jdx.dev/) で固定している。

```bash
mise install                # mise.toml のとおりに Node と pnpm を用意する
pnpm install
cp .dev.vars.example .dev.vars   # ローカル用の secret（git 管理外）
pnpm db:migrate             # ローカル D1 にテーブルを作る
pnpm db:seed                # 両ロールのパスワードと確認用データを入れる
pnpm dev                    # http://localhost:3000
```

E2E テストを動かす場合は、初回だけブラウザを取得する。

```bash
pnpm exec playwright install chromium
```

## よく使うコマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | 開発サーバを起動する（Workers ランタイム上で動く） |
| `pnpm build` | 本番ビルド。`dist/client` と `dist/server` を出力する |
| `pnpm preview` | ビルド結果を Workers ランタイムで確認する |
| `pnpm lint` | Biome による Lint と書式チェック |
| `pnpm lint:fix` | Lint と書式の自動修正 |
| `pnpm typecheck` | TypeScript の型チェック |
| `pnpm test` | Vitest による単体テスト |
| `pnpm test:e2e` | Playwright による E2E テスト |
| `pnpm db:generate` | スキーマの変更からマイグレーション SQL を生成する |
| `pnpm db:migrate` | ローカル D1 にマイグレーションを適用する |
| `pnpm db:seed` | ローカル D1 に初期データを投入する（何度でも実行できる） |
| `pnpm cf-typegen` | `wrangler.jsonc` から binding の型を再生成する |
| `pnpm deploy` | ビルドして本番へデプロイする |

`wrangler.jsonc` を変更したら `pnpm cf-typegen` を実行して `worker-configuration.d.ts` を更新する。

デプロイ先を E2E で確認したい場合は接続先を指定する。

```bash
E2E_BASE_URL=https://orch-extras-mgmt.atsu-dq9.workers.dev pnpm test:e2e
```

## データベース

Cloudflare D1 を binding 名 `DB` で使う。テーブル定義は[設計書](docs/design.md)の6章が正。

- スキーマは `src/db/schema.ts`（Drizzle ORM）
- `pnpm db:generate` が `migrations/` に SQL を生成し、適用は `wrangler d1 migrations apply` が行う
- サーバ関数からは `src/db/client.ts` の `getDb()` を使う。binding は呼び出しごとに読む

本番への適用は main へのマージ時に CD が行う。手元から流す場合は影響が及ぶので事前に確認を取ること。

```bash
pnpm db:migrate                                                # ローカル
pnpm exec wrangler d1 migrations apply DB --remote             # 本番
pnpm exec wrangler d1 execute DB --local --command "SELECT 1"  # 中身を見る
```

### 初期データ

`pnpm db:seed` が `.dev.vars` の値から両ロールのパスワードを投入する。何度実行してもよく、2回目以降はパスワードだけを更新する。確認用の演奏会・練習・曲は、データベースが空のときだけ入る。

## 環境変数

ローカルでは `.dev.vars`（git 管理外）、本番では `wrangler secret put` で設定する。必要な項目は `.dev.vars.example` と[設計書](docs/design.md)の10章を参照。`PASSWORD_PEPPER` を変えると既存のパスワードが検証できなくなるため、変更したら `pnpm db:seed` で入れ直す。

## CI/CD

- **CI**（`.github/workflows/ci.yml`）: PR で Lint・型チェック・単体テストを実行する
- **CD**（`.github/workflows/deploy.yml`）: main へのマージで、検査 → ビルド → 本番 D1 へのマイグレーション適用 → デプロイを実行する

CD には GitHub Secrets に `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` の登録が必要。
