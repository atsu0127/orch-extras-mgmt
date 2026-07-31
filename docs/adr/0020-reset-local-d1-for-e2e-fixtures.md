---
status: "accepted"
date: 2026-07-31
---

# E2E はローカル D1 を `--reset` で固定フィクスチャへ戻す

## Context and Problem Statement

主要導線の E2E（閲覧・管理の登録）を安定させるには、毎回同じ初期データが必要になる。既存の `pnpm db:seed` は空のときだけサンプルを入れるため、管理導線が書いたデータや途中失敗後の状態が残り、再実行で結果が変わる。どこで・どう初期化するかを決める必要がある。

## Considered Options

- Playwright の `globalSetup` から `pnpm db:seed --reset` でローカル D1 を空にして固定フィクスチャを入れ直す
- テスト用のリセット API をアプリに足し、各テストから呼ぶ
- `.wrangler/state` を消して migrate + seed を毎回やり直す

## Decision Outcome

採用: **`globalSetup` + `db:seed --reset`**。アプリにテスト専用エンドポイントを増やさず、既存の wrangler ローカル D1 操作に寄せられる。state ディレクトリ削除は migrate の再適用コストが大きく、部分的な汚れにも重い。

`--reset` はローカル専用とし、`--remote` との併用は拒否する。通常の `pnpm db:seed`（空のときだけサンプル）は開発用として残す。フィクスチャのラベルは `scripts/e2e-fixtures.ts` に集約し、seed と断言で共有する。

### Consequences

- 良い: E2E の再実行が同じ初期状態から始まり、CI でも同じ手順で再現できる
- 悪い: `globalSetup` のたびに D1 を書き換えるため、手元で `pnpm dev` を開きながら E2E を走らせると開発用データも消える
