---
status: "accepted"
date: 2026-07-26
---

# Worker のエントリでは Start の fetch をそのまま公開せずラップする

## Context and Problem Statement

`wrangler.jsonc` の `main` は Start 既定のエントリではなく自前の `src/server.ts` に向けている（設計書5.1）。当初は Cron の `scheduled` ハンドラも公開する計画だったが、ADR-0014 でリンク切れ検知とともに見送った。以下の `fetch` ラッパーは binding の誤受け渡しを防ぐため、引き続き必要である。

T0-6 で D1 の binding を追加して `Env` 型が空でなくなった時点で、`fetch: handler.fetch` と直接公開していた書き方が型エラーになった。Workers はハンドラに `(request, env, ctx)` を渡すが、Start の `handler.fetch` は第2引数を**自身のオプション**として解釈するため、`Env` がオプションの位置に入ってしまう。

## Considered Options

- `fetch(request) { return handler.fetch(request) }` とラップし、`request` だけを渡す
- `handler.fetch` をそのまま公開し、`as` で型を押し込む
- `satisfies ExportedHandler<Env>` を外して型チェックを緩める

## Decision Outcome

採用: **ラップして `request` だけを渡す**。

これは型エラーの回避策ではなく、実行時の誤りを防ぐための措置である。型を押し込む案と検査を緩める案は、どちらもエラー表示を消すだけで、Workers の `env` が Start のオプション引数として渡る状態は残る。binding が増えるほど影響が読めなくなるため、引数の受け渡しを明示的に断つ形にした。

### Consequences

- 良い: 型と実行時の両方で、Start に意図しない引数が渡らないことが保証される
- 悪い: 一見すると無意味な委譲に見えるため、単純化しようとして元に戻される恐れがある。`src/server.ts` に理由をコメントで残してある
