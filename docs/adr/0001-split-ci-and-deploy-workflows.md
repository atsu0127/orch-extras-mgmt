---
status: "accepted"
date: 2026-07-26
---

# CI は PR だけで動かし、main への push は Deploy が検査も兼ねる

## Context and Problem Statement

設計書12章は「PR で Lint・型チェック・Vitest を実行し、main へのマージでマイグレーション適用とデプロイを行う」としか決めていない。これを GitHub Actions に落とすとき、当初 `ci.yml` を `pull_request` と `push` の両方で起動する形にしたため、main へマージした瞬間に `ci.yml` と `deploy.yml` が同じ検査を二重に走らせていた。

無駄な実行を消しつつ、**検査を通っていないコードが本番に出ない**ことをどう保証するかを決める必要があった。

## Considered Options

- `ci.yml` を `pull_request` 限定にし、main では `deploy.yml` が検査も行う
- `ci.yml` を `pull_request` と `push` の両方で回し、`deploy.yml` はデプロイだけを行う
- 1つのワークフローにまとめ、`if` でデプロイ手順だけ切り替える

## Decision Outcome

採用: **`ci.yml` を `pull_request` 限定にし、main では `deploy.yml` が検査からデプロイまでを1ジョブで通す**。

2つ目は、`deploy.yml` が `ci.yml` の成否を知らないため、検査が落ちてもデプロイが走る余地が残る。別ワークフローの結果を待つには `workflow_run` を挟むことになり、構成が複雑になるうえ実行も直列で遅くなる。同一ジョブに並べれば、前の手順が落ちた時点で止まることが GitHub Actions の既定の挙動として保証される。

3つ目は、PR とデプロイで必要な権限（`secrets` へのアクセス）が違うため、`if` が増えて読みにくくなる。

`concurrency` の設定も役割に合わせて変えた。PR は新しい push が来たら古い実行を打ち切る（`cancel-in-progress: true`）。デプロイは本番への適用が競合しないよう、打ち切らずに待たせる（`cancel-in-progress: false`）。

### Consequences

- 良い: 本番に出るコードは必ず同じジョブ内で検査を通る。ワークフローをまたいだ前提を持たない
- 悪い: 検査手順が `ci.yml` と `deploy.yml` に重複する。片方だけ直す事故が起きうるので、検査を増やすときは両方直す（T7-4 で Playwright を PR の検査に加えるときが最初の該当箇所）
