---
status: "accepted"
date: 2026-07-26
---

# 列挙値の妥当性は CHECK 制約ではなくアプリ層で担保する

## Context and Problem Statement

設計書6.1には値域が決まっている列が4つある。`concerts.status`（`active` / `archived`）、`link_checks.verdict`（4値）、`link_checks.target_type`（現状 `bowing` のみ）、`credentials.role`（`admin` / `extra`）である。

SQLite は `CHECK` 制約でこれを DB 側から強制できる。T1-1 でスキーマを書くにあたり、強制をどこに置くかを決める必要があった。

判断を難しくしたのは設計書13章で、`link_checks.target_type` に `practice_media` を追加するだけで録音リンクもチェック対象にできる、と将来の拡張の入口として書かれていることである。SQLite は `ALTER TABLE` で `CHECK` 制約を変更できず、テーブルを作り直してデータを移す必要がある。

## Considered Options

- Drizzle の `enum` オプションで型を付け、実行時の検証は zod（設計書6.3）に任せる
- 上記に加えて `CHECK` 制約を置く
- 値ごとにマスタ表を作り、外部キー制約で縛る

## Decision Outcome

採用: **Drizzle の `enum` オプションと zod のみで担保する**。

`CHECK` 制約を足しても、防げるのは「アプリを経由しない直接の書き込み」だけである。書き込み経路はサーバ関数に限られ、そこは zod を必ず通す（設計書8.4・6.3）。得られる安全性に対して、値を1つ増やすたびにテーブル再作成のマイグレーションが要る代償が見合わない。13章の「追加するだけで済む」を実際に成り立たせることを優先した。

マスタ表案は、値が2〜4個で増減の見込みが無いのに join かサブクエリが増える。無料プランのサブリクエスト上限（設計書5.3）に対して割に合わない。

同じ理由で `created_at` / `updated_at` の既定値も DB の `DEFAULT` ではなく Drizzle の `$defaultFn` / `$onUpdateFn` に置いた。UTC ISO 8601 文字列（設計書5.4）を生成する場所を1か所に保つためである。一方、`status` や `sort_order` のように値が単純な既定値は DDL に残してある。

### Consequences

- 良い: `target_type` への値の追加が、TypeScript の定数を1行足すだけで済む
- 悪い: `wrangler d1 execute` で直接書けば不正な値が入る。手で流す SQL は初期投入スクリプトに限り、そこで正しい値を使う
- 悪い: `created_at` / `updated_at` は Drizzle を経由しない `INSERT` では埋まらない。初期投入スクリプトが明示的に値を入れているのはこのため
