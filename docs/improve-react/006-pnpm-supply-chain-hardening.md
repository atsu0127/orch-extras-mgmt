# 006 — pnpm-workspace に供給連鎖 hardening を入れる

- **Status**: TODO
- **Commit**: 90a50e7
- **Severity**: MEDIUM
- **Category**: Security
- **Rule**: `react-doctor/require-pnpm-hardening`
- **Estimated scope**: 1 file (+ lock 再生成の可能性), 小

## Problem

`pnpm-workspace.yaml` に供給連鎖向けの遅延・信頼ポリシーがない。

```yaml
# pnpm-workspace.yaml — current
allowBuilds:
  esbuild: true
  workerd: true
```

React Doctor は次を要求する（canonical）:

> Add the missing keys to `pnpm-workspace.yaml` and re-lock with `pnpm install`: set `minimumReleaseAge: 10080` (7 days) …; set `trustPolicy: no-downgrade` …; and leave `blockExoticSubdeps: true` (the recent-pnpm default) — never set it to `false` …

## Target

```yaml
# pnpm-workspace.yaml — target
minimumReleaseAge: 10080
trustPolicy: no-downgrade
allowBuilds:
  esbuild: true
  workerd: true
```

`blockExoticSubdeps: false` は書かない（既定 true を維持）。

## Repo conventions to follow

- 既存コメント（esbuild / workerd の allowBuilds）は残す
- 依存集合を意図的に変えない。hardening だけ

## Steps

1. 上記キーを `pnpm-workspace.yaml` に追加
2. `pnpm install` を実行し、lockfile が必要なら更新（差分が出たら含める）
3. CI / ローカルで install が通ることを確認。7日未満の新パッケージで install が落ちる場合は、そのパッケージの採用判断を報告してから `minimumReleaseAgeExclude` 等を検討（勝手に除外リストを広げない）

## Boundaries

- Do NOT `package.json` の依存バージョンを上げる作業を同梱する
- Do NOT `blockExoticSubdeps: false`
- STOP if 現行 pnpm バージョンがこれらのキーを未サポートなら、対応バージョンと影響を報告する

## Verification

- **Mechanical**: `npx react-doctor@latest`（または `--scope changed`）で `require-pnpm-hardening` の2件が消える。`pnpm install` 成功
- **Behavior check**: アプリのビルド／テストに影響しないこと（`pnpm lint` / `pnpm typecheck` / `pnpm test`）
- **Done when**: hardening キーが入り、診断がクリア
