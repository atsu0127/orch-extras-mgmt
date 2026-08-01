# 曲の楽譜リンク — タスク

設計は [design.md](./design.md)。横断制約は [platform/design.md](../platform/design.md)。サイズは相対見積り（S: 小さな差分 / M: 中程度 / L: 広い変更）。

## 進捗

- **完了**（2026-08-01）— T1〜T4
- 次に着手できるもの: なし（本機能は完了）

## 進め方

```text
T1（スキーマ・migration）→ T2（query/mutation・単体）→ T3（管理・閲覧 UI）→ T4（文書・検査）
```

## タスク

| ID | 内容 | 完了条件 | 依存 | サイズ |
| --- | --- | --- | --- | --- |
| T1 | `pieces.score_without_bowing_url` を schema と D1 migration に追加。platform 用語・決定索引を更新 | `pnpm db:migrate` で列が付き、型生成が追従する | — | S |
| T2 | pieces の zod・create/update/list に `scoreWithoutBowingUrl` を通し、単体テストを更新 | あり／なしを独立に保存・取得できるテストが通る | T1 | M |
| T3 | `/admin/pieces` と `/pieces` を2リンク表示・入力に変更 | 管理で両方保存でき、閲覧で設定分だけ出る。未設定表示が残る | T2 | M |
| T4 | README・機能 tasks 進捗・全検査 | lint / typecheck / test が通る。必要なら E2E を最小更新 | T3 | S |

## 受け入れ条件

- [x] 曲ごとにボウイングあり／なしの楽譜 URL を保存できる
- [x] 既存 `bowing_url` は「あり」として残る
- [x] 閲覧側は設定されているリンクだけ出す
- [x] 両方未設定は未設定表示
- [x] lint / typecheck / test が通る

## 実装時の注意

- 列削除・リネームはしない（`bowing_url` を残す）
- `link_checks` に新 target を足さない
- 演奏会切り替えでフォーム state が残らない既存パターンを崩さない
