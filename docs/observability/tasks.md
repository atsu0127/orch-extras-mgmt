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
| T1 | 構造化ログヘルパと `server_fn` middleware。`fn` を明示。`getCurrentSession` は出さない。`ok` は例外・redirect・`{ ok: false }` を false にする。`login` の `error` は `invalid` / `rate_limited`。未認証 redirect は `unauthenticated`。validator 拒否は `validation`。CSRF は `server_fn` に出さない。D1 をログ用に増やさない | 単体で JSON 形・本文/IP 混入なし・session 除外・login 失敗・redirect。`getCurrentSession` 以外の `createServerFn` が middleware を通る走査 | — | M |
| T2 | AI案内に `questionId` と `assistant_ask` を足す。handler 開始以降の Claude 前失敗でも1行。validator 拒否では出さない。カウンタは画面の戻り型に足さない | 上限超過・unavailable・成功時の件数。validator 拒否は `server_fn` のみ。本文がログに出ない | T1 | M |
| T3 | Gateway 設定が揃ったときだけ Anthropic の `baseURL` を差し替え、turn ごとにメタデータ3つと `cf-aig-authorization` を付ける。4つ目のメタデータは付けない。未設定・スタブは直結または呼ばない | モックで baseURL・3キー・認証ヘッダが確認できる。未設定でも AI案内が止まらない | T2 | M |
| T4 | wrangler / `.dev.vars.example` / `pnpm cf-typegen`（設定を足した場合）。既存 AI案内 E2E が通る。lint / typecheck / test | 検査が通り、ローカル既定はスタブのまま Gateway 不要 | T3 | S |
| E1 | 認証付き Gateway を作り、設計 5.3 で設定。account / id を Worker へ。`AI_GATEWAY_TOKEN` を secret に | ダッシュボードで Gateway が見え、Worker が認証付きで通る | T4、実行前確認 | S |
| E2 | 本番で少数の質問。成功は同じ `questionId` で Gateway turn 1/2。アプリ JSON に本文・IP が無いこと。invocation log の中身（IP の有無）を見る | 設計8章と9章の受け入れを本番で確認 | E1、実行前確認 | S |

## 受け入れ条件

- [ ] サーバ関数の失敗が Workers Logs で辿れる
- [ ] AI案内の、handler に入った失敗が `reason` と `questionId` で辿れる
- [ ] 本番 Gateway で成功質問の turn 1/2 本文が `questionId` で結べる
- [ ] アプリの構造化 JSON に質問・回答・IP が出ない
- [ ] スタブ / Gateway 未設定で AI案内が止まらない
- [ ] Langfuse と Workers Traces を入れてない
- [ ] lint / typecheck / test が通る

## 実装時の注意

- 画面から drizzle スキーマを参照しない（ログヘルパは `src/lib/` またはサーバ専用モジュール）
- サブリクエストを増やさない（Gateway は宛先差し替えのみ）
- CPU 10ms を守る。本文を Worker ログ用に再シリアライズしない
- 本番 secret とダッシュボード操作は実行前に確認を取る
