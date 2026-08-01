---
status: "accepted"
date: 2026-08-01
---

# 設計とタスクを機能ディレクトリ単位で管理する

## Context and Problem Statement

初回リリースまでは単一の `docs/design.md` / `docs/tasks.md` で全体を管理していた。次期機能（サークルスクエア同期など）を足すと、横断基盤と機能仕様が同じ文書に混ざり、どれが生きている正か・どこに進捗を書くかが曖昧になる。エージェントと人間の両方が、機能単位で設計とタスクを追える置き方に変えたい。

## Considered Options

- 単一の `docs/design.md` / `docs/tasks.md` を拡張し続ける
- 機能ごとに `docs/<feature>/design.md` と `tasks.md` を置き、横断は `docs/platform/design.md` に切り出す。既存の総合文書は `docs/archive/initial/` へ退避する
- `docs/superpowers/specs` / `plans` に機能ごとの仕様・計画を足し、既存 design/tasks は維持する

## Decision Outcome

採用: **機能ごとの `docs/<feature>/design.md` + `tasks.md` と、横断の `docs/platform/design.md`**。既存の総合 design/tasks は初期案として `docs/archive/initial/` に退避し、実装判断の正にしない。`docs/superpowers/` への新規仕様・計画書は作らない。

単一文書の拡張は、次機能のたびに無関係な章が膨らみ、進捗の正も1ファイルに集中して衝突しやすい。superpowers 配下は本リポジトリの AGENTS 方針（機能の design/tasks で足りるときは作らない）と二重管理になる。

未切り出しの画面・スキーマ詳細は archive を**読み取り専用の凍結参照**とし、内容を変える必要が出たら platform または当該機能の design へ移してから更新する（archive 自体は編集しない）。

### Consequences

- 良い: 機能の仕様と進捗の正がディレクトリ単位で明確になる。横断と機能の境界が文書構造に表れる
- 良い: エージェント向けの AGENTS / phase-task が「どのファイルを更新するか」を迷いにくい
- 悪い: 既存機能を全部切り出すまでは archive 参照が残る。切り出し漏れや「正」の言い回しのずれに注意が要る
- 悪い: ADR 索引の更新先が platform に移るため、古い design の14章を触らない運用を明示する必要がある
