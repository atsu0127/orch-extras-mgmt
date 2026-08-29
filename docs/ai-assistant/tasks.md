# AI案内 タスク

設計: [design.md](./design.md)

## 進捗

- **T1〜T9 完了。次は T10（E2E・進捗・検査）** — リリース前の外部作業は E1（Anthropic課金）と E2（本番での少数確認）。本番 Workers secret `ANTHROPIC_API_KEY` は登録済み。この作業環境にキーが無いため実 Claude 確認は未実施で、`ASSISTANT_LIVE=1` の Vitest と E2 に残している。

## 実装順序

- [x] **T1: AI連携の基盤と利用量テーブル**
  - 最新の `@anthropic-ai/sdk` を追加する
  - `ANTHROPIC_API_KEY` のローカル例・Worker型・機能内の設定読み取りを追加する
  - `ai_usage_daily` のスキーマ、マイグレーション、日別upsertを実装する
  - 質問・回答を保存しないことを単体テストで確認する
  - `wrangler.jsonc` を変更した場合は `pnpm cf-typegen` を実行する

- [x] **T2: 読み取り専用 `search_portal`**
  - ツール入力・結果・参照キーの共有型とzodスキーマを追加する
  - 演奏会名の完全一致優先・曖昧候補を実装する
  - 6トピックの検索を既存query層へ委譲して実装する
  - 3トピック、30件、20,000文字の上限を強制する
  - 日付文字列、キーワード、別演奏会を単体テストする

- [x] **T3: Claude tool useの手動ループ**
  - AIクライアントの差し替え可能な境界を作る
  - 1回目の `tool_use`、D1検索、2回目の最終回答を実装する
  - モデル、履歴、出力、ツール回数、自動リトライの上限を強制する
  - 最終回答と参照キーを検証し、検証済みリンクだけを返す
  - 登録情報なし、曖昧候補、不正引数、再ツール要求、API障害を単体テストする

- [x] **T4: 会話履歴と共有クライアント状態**
  - admin / extra 別のバージョン付き `localStorage` 形式を実装する
  - 最大10会話・20メッセージ、個別削除、全削除を実装する
  - 最初の質問から会話名をローカル生成する
  - クイック表示と専用ページで同じ状態を共有する
  - 演奏会切り替え、再読み込み、破損履歴の回帰テストを書く

- [x] **T5: AI案内のクイック表示**
  - 閲覧画面へ「AIに聞く」入口を追加する
  - スマートフォンは下部シート、PCは右側パネルとして表示する
  - 候補質問、質問入力、回答、演奏会タグ、参照リンクを表示する
  - 読み込み中、登録情報なし、再試行、利用不可を表示する
  - 「専用ページで開く」で同じ会話を引き継ぐ

- [x] **T6: AI案内の専用ページとナビ**
  - 認証済み `/assistant` ルートを追加する
  - PC上部ナビとスマートフォン下部ナビへ「AI案内」を追加する
  - PCは履歴と会話の2列、スマートフォンは履歴を開閉する構成にする
  - 会話の新規作成・切り替え・削除・全削除を実装する
  - クイック表示との往復、検索クエリ維持、レスポンシブ表示をテストする

- [x] **T7: 結合・E2E・実API確認**
  - CI用の決定的なテストAIクライアントを用意する
  - 両ロール、未ログイン、端末別動線、別演奏会、根拠リンク、エラーをE2Eで確認する
  - 登録本文中の命令をデータとして扱う回帰ケースを追加する
  - `pnpm lint`、`pnpm typecheck`、`pnpm test`、Playwrightを通す
  - ローカルで実Claude APIの代表質問を確認し、トークン数と概算費用を記録する（この環境にキーが無いため未実施。`src/assistant/live.test.ts` を `ASSISTANT_LIVE=1` で実行する。本番確認は E2）
  - 構成・コマンド・環境変数に変更があれば `README.md` を更新する

- [x] **T8: 呼び出し上限のスキーマと枠の確保**
  - `ASSISTANT_LIMITS` に `ipWindowMs`（10分）、`ipQuestionsMax`（15）、`dailyQuestionsMax`（80）を足す
  - `ai_ask_attempts`（`id`, `ip`, `attempted_at`。`(ip, attempted_at)` インデックス）と `ai_usage_daily.accepted_question_count` を schema と **新規マイグレーション 0005**（SQL と `migrations/meta`）で追加する。0004 は書き換えない
  - 確保ロジックは `src/assistant/quota.ts`（`src/auth/rate-limit.ts` に足さない）
  - `reserveAssistantQuota(db, { ip, now })` の戻り値は `'ok' | 'ip_limited' | 'daily_limited'`
  - 日次は `INSERT accepted_question_count=1 ON CONFLICT DO UPDATE SET accepted_question_count = accepted_question_count + 1 WHERE accepted_question_count < 80`。変更行数 0 なら拒否。空行 INSERT（0）と +1 を混ぜない
  - `recordDailyUsage` の日付を `todayInJst(now)` にする。`accepted_question_count` は加算も上書きもしない
  - `scripts/seed.ts` のリセットに `DELETE FROM ai_ask_attempts`（と sqlite_sequence）を足す
  - 単体テスト（固定 `NOW` / `nowPlus`、別 IP。`rate-limit.test.ts` と同じ形）: 15問まで通り16問目は `ip_limited`、窓が滑るとまた通る、80問まで通り81問目は `daily_limited`、JST 0時で戻る、拒否時は IP 行も全体も増えない
  - JST フィクスチャ: `2026-08-16T14:59:59.999Z` → 16日、`2026-08-16T15:00:00.000Z` → 17日、`2026-08-17T12:00:00.000Z` → 17日のまま、`2026-08-17T15:30:00.000Z` → 18日

- [x] **T9: 質問ループと画面へ上限を接続する**
  - `askAssistant` で `getClientIp()` を取り、`answerQuestion` に `ip` と `now` を渡す
  - スタブまたは API キーありのときだけ `answerQuestion`（確保あり）。キー無しの `unavailable` は確保しない
  - `answerQuestion` は Claude 用 try の**外**で `reserveAssistantQuota` する。`ok` でなければクライアント 0 回。確保の例外は `unavailable`。掃除失敗は無視して Claude を呼ぶ
  - `AskAssistantFailureReason` に `ip_limited` / `daily_limited` を足し、設計書の文言を `ASK_ASSISTANT_ERROR_MESSAGES` に置く
  - `shouldOfferRetry`（名前は実装に合わせる）を単体テストする。`ip_limited` / `daily_limited` は false（ボタンなし）、`timeout` / `failed` は true。`thread.tsx` はこれを使う
  - `loop.test.ts`: `ip_limited` と `daily_limited` の両方でクライアント 0 回。確保後の API 失敗でも `accepted_question_count` は 1。既存の「集計失敗でも回答する」は加算用 SQL（`successful_question_count` / `api_request_count` 等）だけ例外にし、確保用 SQL では投げない。確保失敗専用テストを別に書く
  - 既存の日別集計テストを JST に合わせる。15:30Z だけ 18日。12:00Z は 17日のまま一括置換しない

- [ ] **T10: E2E・進捗・検査**
  - 既存 AI の E2E が IP `local` 共有でも 15問未満に収まることを確認する（1ランの実質問は5回。16問を足して発火させない）
  - 上限超過の E2E は必須にしない（テスト専用 API を増やさない）
  - `docs/README.md` の AI案内の状態を更新する
  - `pnpm lint` / `pnpm typecheck` / `pnpm test` / ローカルなら Playwright

## リリース前の外部作業

- [ ] **E1: Anthropic APIの課金設定**
  - 利用していないClaude Proを解約し、その予算をAPIへ振り替える
  - Anthropic Consoleで$5分のAPIクレジットを購入する
  - auto-reloadを無効にする

- [ ] **E2: 本番secretと少数確認**
  - 実行前に確認を取り、Cloudflare Workers secret `ANTHROPIC_API_KEY` を登録する（登録済み）
  - 本番で代表質問を少数実行する
  - Anthropic Consoleで想定どおりの利用量か確認する

## フェーズ完了条件

- [x] 初回導入（T1〜T7）の自動テスト・lint・typecheck・Playwright・既存導線の継続を満たす。実 Claude API の代表質問と概算費用は E2 に残す
- [ ] T8〜T10 の呼び出し上限が設計 8.3 どおり単体テストで確認できる
- [x] 各タスクの完了時に本ファイルの進捗を更新する
- [x] 初回導入の仕様レビューと品質レビューを各1回行う
- [ ] T8〜T10 の仕様レビュー（本追記＋指摘反映）と、実装後の品質レビュー

## 実装時の注意

- 画面から `src/db/schema.ts` を読まない。定数・失敗理由・文言は `src/lib/assistant.ts`
- IP の取り方は `src/auth/client-ip.ts` を再利用する。ログイン制限のテーブルには足さない
- 日次は `INSERT accepted=1 ON CONFLICT DO UPDATE ... WHERE accepted < 80`。drizzle で WHERE が書けないときは、**default 0 の空行**を `INSERT OR IGNORE` したあと `UPDATE ... + 1 WHERE < 80`。空行 INSERT を 1 で始めない（初問が 2 になる）
- `recordDailyUsage` の失敗は今までどおり握りつぶす。枠の確保（COUNT・条件付き更新・IP INSERT）は握りつぶさない。掃除は best-effort
- 追加 D1 はサブリクエストに数える。検索クエリは増やさない。日次更新と IP INSERT は `db.batch()` にまとめられるならまとめる
- テスト専用の上限バイパス API は作らない
- ログイン方式・Turnstile・パスワード規則は変えない
- 会場の共有 Wi‑Fi では 10分15問が回線全体の上限になる（受け入れ済み）
