---
status: "accepted"
date: 2026-08-29
---

# サーバ関数はヘルパで包まず、ログは middleware だけ足す

## Context and Problem Statement

観測の T1 では `getCurrentSession` 以外の `createServerFn` に構造化ログを付けたい。最初は `loggedServerFn()` のようなヘルパで `createServerFn` を包み、名前と middleware を一箇所にまとめようとした。実装すると TanStack Start のコンパイラがサーバ関数を抽出できず、クライアントバンドルへ `cloudflare:workers` などのサーバ専用モジュールが載り、E2E が壊れた。影響はサーバ関数の定義の書き方と、観測の付け忘れ防止。

## Considered Options

- 各ファイルで `createServerFn` を書き、middleware 先頭に `logServerFn('名前')` を置く。付け忘れはソース走査テストで防ぐ
- `loggedServerFn()` で `createServerFn` を包み、名前とログを強制する
- Babel / Vite プラグインで `createServerFn` を書き換え、ログを自動挿入する

## Decision Outcome

採用: **ファイル内に `createServerFn` を残し、ログは middleware だけ足す**。Start のコンパイラは呼び出し箇所をソース上で見つける前提で、ヘルパに閉じ込めると抽出に失敗する。プラグインは観測のためだけにビルドを複雑にする。走査テスト（`src/observability/create-server-fn-scan.test.ts`）で `getCurrentSession` 以外の付け忘れを止める。

### Consequences

- 良い: クライアントへサーバ専用コードが漏れない。既存の認可 middleware の並びにログを足すだけ
- 悪い: 新しいサーバ関数を足すときに `logServerFn` を書き忘れる余地がある。走査テストが赤くなるまで気づかない
