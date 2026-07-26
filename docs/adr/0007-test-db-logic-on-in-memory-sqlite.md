---
status: "accepted"
date: 2026-07-26
---

# DB を伴うロジックの単体テストは node:sqlite の in-memory DB で行う

## Context and Problem Statement

T2-2 のセッション管理と T2-5 のレート制限は、ロジックの本体が D1 への問い合わせにある。「期限切れを弾く」「直近5分の失敗を数える」といった振る舞いは、`where` 句が正しいかどうかそのものである。

単体テストは Vitest の node 環境で動かす構成になっており（`AGENTS.md`）、`cloudflare:workers` の binding も D1 も無い。どうやって検証するかを決める必要があった。

## Considered Options

- Drizzle のクライアントをモックし、呼ばれたクエリの形を検証する
- `@cloudflare/vitest-pool-workers` を入れ、Miniflare の D1 に対して実行する
- Node 24 同梱の `node:sqlite` を `drizzle-orm/sqlite-proxy` 経由で Drizzle につなぐ

## Decision Outcome

採用: **`node:sqlite` を `drizzle-orm/sqlite-proxy` でつなぐ**（`src/test/db.ts`）。テストごとに in-memory の DB を作り、`migrations/` の SQL をそのまま流してテーブルを用意する。

モック案は落とした。検証できるのは「自分が書いたつもりのクエリ」であって、それが SQLite でどう評価されるかではない。期限の境界を確かめたい場面で意味を持たない。

`vitest-pool-workers` 案も落とした。本物に近いのは確かだが、Vitest の設定が Workers プール用に変わり、node 環境で軽く回す今の構成を崩す。Phase 2 で検証したいのは SQL の意味論であって Workers ランタイムの挙動ではないので、代償が見合わない。

マイグレーション SQL をそのまま流す点が効いている。スキーマを変えたのにテストだけ古い定義で通る、という食い違いが起きない。

`src/auth/functions.ts` が `cloudflare:workers` を import するため、ルータ経由で間接的に読み込まれるテストが解決に失敗する。これは `vitest.config.ts` で空の stub（`src/test/cloudflare-workers-stub.ts`）へ差し替えて回避している。

### Consequences

- 良い: 追加の依存が要らない。`node:sqlite` は Node 24 に同梱されている
- 良い: マイグレーションを流すので、スキーマ変更がテストに反映される
- 悪い: D1 固有の挙動（バッチの扱い、サブリクエストの数え方）は再現しない。そこは E2E か手元の `pnpm dev` で確かめる
- 悪い: `sqlite-proxy` の薄いアダプタを自前で持つことになる。Drizzle 側の戻り値の期待（`get` で該当なしのとき `undefined` を返す等）に追従する必要がある
