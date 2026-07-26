# orch-extras-mgmt

オーケストラのエキストラ（客演奏者）向け情報ポータル。練習日程と出欠の回答先、ボウイング、練習の録音を1か所にまとめて公開し、管理者がブラウザから更新できるようにする。

現在の状態: **Phase 0 完了（土台と自動デプロイ）**。画面はまだプレースホルダのみ。

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
mise install          # mise.toml のとおりに Node と pnpm を用意する
pnpm install
pnpm dev              # http://localhost:3000
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
| `pnpm cf-typegen` | `wrangler.jsonc` から binding の型を再生成する |
| `pnpm deploy` | ビルドして本番へデプロイする |

`wrangler.jsonc` を変更したら `pnpm cf-typegen` を実行して `worker-configuration.d.ts` を更新する。

デプロイ先を E2E で確認したい場合は接続先を指定する。

```bash
E2E_BASE_URL=https://orch-extras-mgmt.atsu-dq9.workers.dev pnpm test:e2e
```

## データベース

Cloudflare D1 を binding 名 `DB` で使う。マイグレーションは `migrations/` に置き、`wrangler d1 migrations apply` で適用する（スキーマ定義は Phase 1 で追加）。

```bash
pnpm exec wrangler d1 execute DB --local  --command "SELECT 1"   # ローカル
pnpm exec wrangler d1 execute DB --remote --command "SELECT 1"   # 本番
```

## CI/CD

- **CI**（`.github/workflows/ci.yml`）: PR で Lint・型チェック・単体テストを実行する
- **CD**（`.github/workflows/deploy.yml`）: main へのマージで、検査 → ビルド → 本番 D1 へのマイグレーション適用 → デプロイを実行する

CD には GitHub Secrets に `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` の登録が必要。
