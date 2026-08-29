# 観測（アプリケーションログと LLM 品質ログ）

最終更新: 2026-08-29

横断制約は [platform/design.md](../platform/design.md)。AI案内の本文扱いの例外は [ai-assistant/design.md](../ai-assistant/design.md) 9章。判断の経緯は [ADR-0028](../adr/0028-workers-logs-and-ai-gateway-observability.md)。タスクは [tasks.md](./tasks.md)。

## 1. 目的

本番で次を追えるようにする。

- サーバ関数の失敗（認可・入力・例外）と、AI案内が Claude まで届かなかった理由
- 質問に対する回答の品質と、Claude がそう答えた根拠（見えた入力・ツール結果・最終出力）

月次のトークンと費用の正は変えない。既存の D1 `ai_usage_daily` と Anthropic Console を使う。

## 2. スコープ

**やること**

- Workers Logs へ構造化 JSON のアプリケーションログを出す
- 本番の実 Claude 呼び出しを Cloudflare AI Gateway 経由にし、プロンプト・ツール・回答本文を Gateway に残す
- 1質問を `questionId` でアプリログと Gateway の2本（turn 1 / 2）を結ぶ

**やらないこと**

- Langfuse / LangSmith / Sentry などの外部 LLMOps・APM
- Workers Traces（遅延は見ない。D1 スパンに SQL が載り得る）
- Logpush、アラート、管理画面からのログ閲覧
- 質問・回答の D1 保存
- Gateway のキャッシュ、自動リトライ、フォールバック、レート制限
- 会話セッション UI（会話は従来どおり `localStorage`）

## 3. 構成

観測は2系統。Worker が受けるのはほぼ `/_serverFn/*` だけなので、ログ量は無料枠（Workers Logs 20万件/日、保持3日）に対して問題にならない。

```
ブラウザ
  → Worker サーバ関数
       ├─ console.log(JSON) → Workers Logs
       │     本文・IP なし。失敗理由と questionId
       └─ Anthropic（本番のみ baseURL を AI Gateway へ）
             └─ Gateway が HTTP のリクエスト／レスポンス本文を保存
                メタデータ: questionId, turn, role
```

| 知りたいこと | 見る場所 |
| --- | --- |
| サーバ関数の例外、ログイン失敗、Claude 前の失敗 | Cloudflare Observability（Workers Logs）の構造化 `console.log` |
| CSRF 403 などサーバ関数に届かない拒否 | 同上の invocation log（`server_fn` 行は出ない） |
| その質問で Claude が見たもの・返したもの | AI Gateway ログを `questionId` で絞る。成功時は turn 1 と 2。失敗時は turn 1 のみ、または 0 本 |
| 月次トークン・費用 | D1 `ai_usage_daily` と Anthropic Console |

`wrangler.jsonc` の `observability.enabled` は既に true。Traces は有効にしない。invocation log（起動ログ）は Cloudflare がリクエストごとに出す別物で、アプリの JSON とは独立する。詳細は 4.3。

## 4. アプリケーションログ

`console.log` に JSON オブジェクトを渡す。Workers Logs がフィールドで索引できるようにする。文字列連結でキーを埋め込まない。レベルは `console.log` に統一し、成否は `ok` で分ける。

サーバ関数の URL はハッシュになりうるので、**関数名 `fn` はアプリが明示する**。

### 4.1 `server_fn`

`getCurrentSession` 以外のすべてのサーバ関数が、呼び出しあたり1行出す。`getCurrentSession` はログイン前の入口で情報量が少なく、除外する（セッション照会を画面遷移ごとに増やさない判断は [ADR-0005](../adr/0005-cache-session-lookup-on-client.md)）。

ログ用 middleware は `requireAuth` の外側に置く。`role` は `requireAuth` が既に載せた context から取り、ログのためだけにセッションを D1 へ再照会しない。未認証時は `anonymous`。

| フィールド | 内容 |
| --- | --- |
| `event` | `"server_fn"` |
| `fn` | アプリが付ける名前（`login`, `addPractice`, `askAssistant` など） |
| `ok` | 呼び出し側が成功として使える結果を返したか。例外・`redirect`・戻り値 `{ ok: false }` は false |
| `durationMs` | サーバ関数の壁時計時間。LLM 内訳は出さない |
| `role` | `admin` / `extra`。未ログイン・未認証は `anonymous`。`login` 成功時は確定したロール |
| `error` | `ok: false` のとき。短いコードのみ。メッセージ本文は入れない |

`error` の決め方:

- `requireAuth` の `redirect` → `unauthenticated`（記録してから同じ redirect を投げ直す）
- 戻り値が `{ ok: false, reason }` → `reason` をそのまま使う。`login` は `invalid` / `rate_limited`（`src/auth/functions.ts` の `LoginResult` に合わせる）
- それ以外の例外 → クラス名か短いコード
- `.validator()` 拒否 → ハンドラに入らない。`ok: false`。`error` は `validation`。`questionId` は切らない

CSRF 検証は `src/start.ts` の request middleware で 403 になり、サーバ関数 middleware に到達しない。`server_fn` 行は出ない。痕跡は invocation log だけである。

試行 IP は D1 `login_attempts` が正で、アプリの JSON には出さない。

### 4.2 `assistant_ask`

`askAssistant` の **handler 開始以降**に1行出す。handler 先頭で UUID を切り、それを `questionId` とする。Claude に届く前の失敗（枠超過、キー無しの `unavailable` など）でも出す。

`.validator()`（`askAssistantInputSchema`）の拒否では handler に入らないため `assistant_ask` は出さない。その場合の記録は `server_fn`（`fn: "askAssistant"`）だけである。`reason: invalid_input` は Claude 1回目のあとのツール引数検証失敗を指し、このとき `apiRequestCount` は 1 である。

| フィールド | 内容 |
| --- | --- |
| `event` | `"assistant_ask"` |
| `questionId` | UUID。Gateway のメタデータと同じ値 |
| `ok` | 画面に回答を返せたか |
| `reason` | 失敗時のみ。既存の `invalid_input` / `unavailable` / `timeout` / `tool_limit` / `failed` / `ip_limited` / `daily_limited` |
| `role` | `admin` / `extra` |
| `stub` | スタブ経路なら `true`。常に出す |
| `gateway` | この質問で AI Gateway を通したか。常に出す |
| `apiRequestCount` | 実際に Claude を呼んだ回数（0〜2） |
| `droppedSourceKeys` | 成功時のみ。検証で捨てた参照キー件数（キー文字列は出さない） |
| `selectedConcertId` | 選択中演奏会の ID（名前は出さない） |

同じリクエストで `server_fn`（`fn: "askAssistant"`）と `assistant_ask` の両方を出してよい。`apiRequestCount` と `droppedSourceKeys` はログ専用の経路で渡し、`AskAssistantResult`（画面へ返す型）には足さない。

### 4.3 出さないもの

Worker ログ（`server_fn` / `assistant_ask` / 例外の付随出力）に次を出さない。

- 質問、会話履歴、回答本文
- `search_portal` の引数と結果、参照 URL、参照キー文字列
- IP、Cookie、セッショントークン、パスワード
- Anthropic の生エラーボディ、SQL

未捕捉例外のスタックはランタイムが出しうる。アプリが足す `error` はコードだけにする。

invocation log はアプリ JSON とは別に Cloudflare が出す。Cookie など機密らしい名前のヘッダは伏字になるが、`CF-Connecting-IP` 相当が残るかはアプリでは制御しない。アプリは IP を JSON に出さない。invocation log に IP が含まれていた場合はスタックと同様のランタイム出力として扱い、受け入れの「アプリ JSON に IP が無い」とは別件とする。E2 で中身を確認する。含まれることが運用上困るなら `observability.logs.invocation_logs: false` を検討する（CSRF 403 の痕跡も消える）。この設計の既定では invocation log を消さない。

## 5. AI Gateway

### 5.1 通し方

本番の実 Claude 呼び出しだけ、Anthropic SDK の `baseURL` を次に差し替える。

```text
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/anthropic
```

サブリクエストは「Anthropic 直」が「Gateway 経由」に変わるだけで増えない。`maxRetries: 0` と 20 秒タイムアウトは維持する。`ANTHROPIC_API_KEY` は今どおり Worker が持ち、Gateway の BYOK にはしない。認証トークンは `cf-aig-authorization: Bearer {AI_GATEWAY_TOKEN}` で付ける。

通さない経路:

- `ASSISTANT_STUB=1`
- Claude を呼ぶ前の失敗（枠超過、入力不正、キー無しの `unavailable` など）
- Gateway 用の id / 認証が無い環境（ローカルの実 API 確認を含む）。このときは `api.anthropic.com` へ直結し、AI 案内は止めない。`assistant_ask.gateway` は `false`

### 5.2 メタデータ

`cf-aig-metadata` は最大5キーのうち次の3つだけ。IP は付けない。

| キー | 値 |
| --- | --- |
| `questionId` | アプリログと同じ UUID |
| `turn` | `1`（ツール要求）または `2`（最終回答） |
| `role` | `admin` / `extra` |

品質調査は、Workers Logs の `questionId` で Gateway を絞る。成功した質問は turn 1（検索条件）と turn 2（`tool_result` と最終回答）が揃う。turn 1 のあとで失敗した場合（`timeout` / `tool_limit` / `failed` など、`apiRequestCount: 1`）は turn 1 だけが残る。Claude 前の失敗は 0 本である。turn が欠けていること自体が調査対象であり、欠落を異常とはしない。1質問を1本の木としては見せない（Langfuse は見送り）。

### 5.3 ダッシュボード設定

Gateway はこのアプリ専用に1つ作る。

| 設定 | 値 | 理由 |
| --- | --- | --- |
| 認証 | オン | トークン無しの流入と、ダッシュボード外からのログ閲覧を防ぐ |
| Logs | オン | 品質調査の本体 |
| 本文（payload） | オン | 「なぜそう答えたか」に本文が要る |
| 自動で古いログ削除 | オン | 無料枠の件数上限で新規保存が止まるのを避ける |
| キャッシュ | オフ | 登録情報の鮮度 |
| リトライ / フォールバック | オフ | アプリの `maxRetries: 0` と揃える |
| レート制限 | オフ | 上限は既存の IP / 日次枠が正 |

無料プランの Gateway ログはアカウント合計 10万件。1問あたり最大2本、日80問でも量は問題にならない。保持は件数上限までで、Workers Logs の3日より長く残る想定。月次費用の正には使わない。

### 5.4 プライバシー

質問・回答・ツール結果を Worker ログと D1 に出さない方針は維持する。**本文を残す場所は認証付き AI Gateway だけ**とする例外を、AI案内9章に書く。閲覧は Cloudflare アカウント保持者に限る。

## 6. 環境変数

| 名前 | 種別 | 用途 |
| --- | --- | --- |
| `AI_GATEWAY_ACCOUNT_ID` | 設定 | Cloudflare アカウント ID |
| `AI_GATEWAY_ID` | 設定 | Gateway の id |
| `AI_GATEWAY_TOKEN` | secret | 認証付き Gateway の Bearer |

3つ揃ったときだけ Gateway 経由にする。ローカル既定（`ASSISTANT_STUB=1`）では不要。本番投入はコード後に確認を取ってから行う。

## 7. テスト

CI では Gateway も実 Claude も呼ばない（`ASSISTANT_STUB=1` のまま）。

- `console.log` に渡った JSON に、質問・回答・ツール結果・IP・Cookie が含まれない
- `login` 失敗が `fn: "login"`、`ok: false`、`error: "invalid"` または `"rate_limited"` になる
- `getCurrentSession` が `server_fn` を出さない
- `getCurrentSession` 以外の `createServerFn` がログ middleware を通る（付け忘れを走査する）
- handler に入った Claude 前の失敗でも `questionId` 付きの `assistant_ask` が出る（`apiRequestCount: 0`, `gateway: false`, `stub` も明示）
- `.validator()` 拒否では `assistant_ask` が出ず、`server_fn` の `error` は `validation` になる
- Gateway 設定ありのとき、SDK の `baseURL` とメタデータ3キー（`questionId` / `turn` / `role`）だけが付く。4つ目は付けない（fetch はモック）
- 認証ヘッダが `cf-aig-authorization` である
- Gateway 設定なし・スタブでは直結または Claude を呼ばない

E2E は既存の AI案内が壊れていないことだけ見る。Cloudflare の Observability / Gateway 画面は自動テストしない。

## 8. 受け入れの目安

- サーバ関数の失敗が Workers Logs で `fn` と `ok` / `error` から辿れる
- AI案内の、handler に入った失敗が `reason` と `questionId` で辿れる
- 本番で Gateway を通した**成功**質問は、同じ `questionId` の turn 1/2 に本文がある
- アプリの構造化 JSON に質問・回答・IP が出ない
- スタブ経路と Gateway 未設定では AI案内が止まらない
- lint / typecheck / test が通る

## 9. リリース前の外部作業

実装マージだけでは Gateway は作られない。実行前に確認を取る。

1. Cloudflare で認証付き Gateway を1つ作り、5.3 どおりに設定する
2. `AI_GATEWAY_ACCOUNT_ID` / `AI_GATEWAY_ID` を Worker の設定に入れる
3. `AI_GATEWAY_TOKEN` を secret にする（`ANTHROPIC_API_KEY` はそのまま）
4. 本番で少数の質問を打ち、成功質問は同じ `questionId` で Workers Logs と Gateway の turn 1/2 が揃うことを見る。失敗質問は turn が欠けてよい
5. 同じ確認で invocation log を1件開き、IP や本文がどう出るかを見る。アプリ JSON に本文・IP が無いことは別途確認する
