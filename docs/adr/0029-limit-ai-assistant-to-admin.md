---
status: "accepted"
date: 2026-09-12
---

# AI案内は当面管理者だけが使う

## Context and Problem Statement

初回導入では admin / extra の両ロールが AI案内を使える設計だった。共有パスワードのエキストラが複数人で使うと、試用中の Claude 残高と全体80問/日の枠を、閲覧導線の確認より先に消費しうる。当面は管理者が登録情報の検索を試し、エキストラの画面からは出さないようにしたい。影響は `askAssistant` の認可、`/_authed` のナビとクイック表示、`/assistant` ルート、E2E である。

## Considered Options

- 両ロールのまま公開する（現行）
- 画面だけ隠してサーバー関数は `requireAuth` のままにする
- 画面を隠し、`askAssistant` を `requireAdmin` にし、`/assistant` は extra をホームへ戻す

## Decision Outcome

採用: **画面を隠し、サーバー関数と専用ページも管理者に限る**。SPA の `beforeLoad` に強制力は無いので、見た目だけ隠すと extra が関数を直接呼べる。管理画面と同じく、体験の締め出し（ナビ・フローティングボタン・ルート）と認可の実体（`requireAdmin`）を揃える。履歴の localStorage キーはロール別に残し、あとで extra へ戻すとき既存の保存形式を壊さない。

### Consequences

- 良い: 試用中の残高と日次枠を管理者の確認に使える。extra の閲覧導線に入口が増えない
- 悪い: extra 向けの案内としては使えない。戻すときは本 ADR を覆し、設計の対象ロールと E2E を両ロールに戻す
