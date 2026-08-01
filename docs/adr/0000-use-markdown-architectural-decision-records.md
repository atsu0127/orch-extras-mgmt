---
status: "accepted"
date: 2026-07-26
---

# 実装中の設計判断を MADR 形式の ADR で記録する

## Context and Problem Statement

設計書（当初は `docs/design.md`。2026-08-01 以降の横断索引は `docs/platform/design.md`）は着手前に決めたことをまとめたもので、決定と理由の表がある。しかし実装を始めると、設計書に書かれていない判断が必ず発生する。それを PR の説明文だけに書くと、後から「なぜこうなっているのか」を追うときに PR を掘り返すことになり、実質的に失われる。

判断の経緯を、コードと同じリポジトリに、決定単位で追える形で残したい。

## Considered Options

- `docs/platform/design.md`（当初は `docs/design.md` の14章）の表に1行足すだけで済ませる（従来のやり方）
- MADR（Markdown Architectural Decision Records）の minimal 版を使い、1決定1ファイルで記録する
- Nygard 形式（Context / Decision / Status / Consequences）を使う
- Y-Statement（1文に凝縮する形式）を使う

## Decision Outcome

採用: **MADR minimal 版を `docs/adr/` に置き、`docs/platform/design.md` の決定索引（当初は `docs/design.md` の14章）をその索引にする**。

表への1行追記だけでは、検討した代替案と、その決定で何を犠牲にしたかが残らない。あとで決定を見直すときに必要なのはまさにその部分なので、選択肢と結果を書く欄がある形式にした。MADR を選んだのは `Considered Options` が独立した節としてあるためで、Nygard 形式にはこれが無い。Y-Statement は1文に収める形式で、この規模なら情報が落ちすぎる。

運用は次のとおり。

1. **書くとき**: 実装中に、設計書に書かれていないことを決めたとき。設計書どおりに実装した場合は書かない。設計書の記述そのものを変えるときは、ADR を書いた上で該当の `docs/<feature>/design.md` または `docs/platform/design.md` も直す
2. **ファイル名**: `NNNN-題名.md`（`NNNN` は連番）。`adr-template.md` を写して使う
3. **索引**: 追加したら `docs/platform/design.md` の決定索引に1行足してリンクする。決定を一覧できる場所は1か所に保つ
4. **覆すとき**: 過去の ADR を書き換えない。新しい ADR を追加し、古い方の `status` を `superseded by ADR-NNNN` にする
5. **言語**: 見出しは MADR 原文の英語のままにし、本文は日本語で書く

### Consequences

- 良い: 決定の背景・代替案・代償が、決定ごとに分かれた形でリポジトリに残る。設計書は「今の設計」を語り、ADR は「そう決めた経緯」を語る形に役割が分かれる
- 良い: 見出しを MADR 原文のままにしたので、MADR 前提のツールや他プロジェクトの ADR と行き来しやすい
- 悪い: 索引（platform の決定索引）と本体（`docs/adr/`）の2か所を更新する手間が増える。索引の更新漏れが起きうるので、PR の確認項目に含める
