---
status: "accepted"
date: 2026-08-01
---

# 曲ごとにボウイングあり／なしの楽譜リンクを持てるようにする

## Context and Problem Statement

曲の共有は当初「ボウイングリンク1本」だったが、運用上「ボウイングありの楽譜」と「ボウイングなしの楽譜」を別 URL で渡したい。既存の `pieces.bowing_url` とデータを壊さずに2本目を足す必要がある。

## Considered Options

- 既存 `bowing_url` を残し、`score_without_bowing_url` を追加する（画面ラベルだけ「あり／なし」）
- 両列を `score_with_bowing_url` / `score_without_bowing_url` にリネームしデータ移行する
- リンク用の別テーブルへ切り出し、複数本を一般化する

## Decision Outcome

採用: **既存 `bowing_url` を残し、`score_without_bowing_url` を追加する**。既存データと差分が最小で、今回必要なのは固定2本だから。リネームは追加→移行→削除が要り価値が薄い。別テーブルはパート別などが要件になるまで過剰。

### Consequences

- 良い: マイグレーションが列追加だけで済む。既存の「あり」側 URL がそのまま残る
- 悪い: DB 列名（`bowing_url`）と画面ラベル（ボウイングありの楽譜）がずれる。3本目以降は別途設計が必要
