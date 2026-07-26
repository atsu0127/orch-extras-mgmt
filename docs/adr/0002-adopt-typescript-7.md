---
status: "accepted"
date: 2026-07-26
---

# TypeScript 7（ネイティブ実装）を採用する

## Context and Problem Statement

設計書は言語として TypeScript を使うと決めているが、バージョンは指定していない。着手時点の最新は TypeScript 7 で、これは従来の JavaScript 実装ではなく Go への移植版という別実装である。TanStack Start / Router の型定義は型レベルの計算を多用するため、新しい実装で型解決が食い違う恐れがあった。

`pnpm typecheck`（`tsc --noEmit`）が何で動くかを決める必要があった。

## Considered Options

- TypeScript 7（ネイティブ実装）
- TypeScript 5.x 系（実績のある JavaScript 実装）

## Decision Outcome

採用: **TypeScript 7**。

T0-3 の時点で `tsc --noEmit` を実際に走らせ、TanStack の型定義と `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` の組み合わせでエラーが出ないことを確認してから確定させた。新規プロジェクトで移行対象の設定資産が無く、問題が出たら 5.x に落とすだけで済むため、踏むリスクが小さいと判断した。

### Consequences

- 良い: 型チェックが速く、CI と手元の待ち時間が短い
- 悪い: 依存ライブラリの型定義が 5.x 系の挙動を前提に書かれている場合、食い違いを踏む可能性が残る。踏んだときは 5.x への差し戻しを検討する（`package.json` の1行を戻すだけで済む状態を保つ）
