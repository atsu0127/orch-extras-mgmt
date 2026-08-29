# 観測 — タスク

設計は [design.md](./design.md)。横断制約は [platform/design.md](../platform/design.md)。サイズは相対見積り（S: 小さな差分 / M: 中程度 / L: 広い変更）。

## 進捗

- **設計まで完了**（2026-08-29）。実装は未着手
- 次に着手できるもの: T1

## 進め方

```text
T1（server_fn）→ T2（assistant_ask）→ T3（AI Gateway）→ T4（検査・文書の実装面）
外部: E1（Gateway 作成と secret）→ E2（本番の少数確認）
```

T1〜T3 はコード、T4 は検査と README / 設定例。E1・E2 は本番影響があるため、実装 PR のあと実行前確認する。

## タスク

| ID | 内容 | 完了条件 | 依存 | サイズ |
| --- | --- | --- | --- | --- |
| T1 | 構造化ログヘルパと `server_fn` middleware。`fn` を明示。`getCurrentSession` は出さない。`login` 失敗は短い `error` のみ | 単体で JSON 形・本文/IP が混入しないこと・session 除外・login 失敗が確認できる | — | M |
| T2 | AI案内に `questionId` と `assistant_ask` を足す。Claude 前の失敗でも1行。`gateway` / `apiRequestCount` / `droppedSourceKeys` | 上限超過・unavailable・成功時の件数が単体で確認できる。本文がログに出ない | T1 | M |
| T3 | Gateway 設定が揃ったときだけ Anthropic の `baseURL` を差し替え、turn ごとにメタデータ3つを付ける。未設定・スタブは直結または呼ばない | モックで baseURL とヘッダが確認できる。未設定でも AI案内が止まらない | T2 | M |
| T4 | wrangler / `.dev.vars.example` / `pnpm cf-typegen`（設定を足した場合）。既存 AI案内 E2E が通る。lint / typecheck / test | 検査が通り、ローカル既定はスタブのまま Gateway 不要 | T3 | S |
| E1 | 認証付き Gateway を作り、設計 5.3 で設定。account / id を Worker へ。`AI_GATEWAY_TOKEN` を secret に | ダッシュボードで Gateway が見え、Worker が認証付きで通る | T4、実行前確認 | S |
| E2 | 本番で少数の質問。同じ `questionId` で Workers Logs と Gateway turn 1/2 が揃うこと、Worker ログに本文が無いことを見る | 設計8章の受け入れを本番で確認 | E1、実行前確認 | S |

## 受け入れ条件

- [ ] サーバ関数の失敗が Workers Logs で辿れる
- [ ] AI案内の失敗が `reason` と `questionId` で辿れる
- [ ] 本番 Gateway で turn 1/2 の本文が `questionId` で結べる
- [ ] Worker ログに質問・回答・IP が出ない
- [ ] スタブ / Gateway 未設定で AI案内が止まらない
- [ ] Langfuse と Workers Traces を入れてない
- [ ] lint / typecheck / test が通る

## 実装時の注意

- 画面から drizzle スキーマを参照しない（ログヘルパは `src/lib/` またはサーバ専用モジュール）
- サブリクエストを増やさない（Gateway は宛先差し替えのみ）
- CPU 10ms を守る。本文を Worker ログ用に再シリアライズしない
- 本番 secret とダッシュボード操作は実行前に確認を取る
