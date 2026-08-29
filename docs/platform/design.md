# プラットフォーム設計書

最終更新: 2026-08-29

横断仕様（技術基盤・認証・運用・決定索引）の正。機能固有の仕様は `docs/<feature>/design.md` を正とする。文書の置き方は [docs/README.md](../README.md) を参照。

初回リリース〜Phase 10 までの総合設計は [archive/initial/design.md](../archive/initial/design.md) に退避している。**実装判断の正ではなく凍結参照**（編集しない。変えるときは platform / 機能 design へ移してから更新する）。

## 1. 目的とスコープ（要約）

オーケストラの演奏会でエキストラに伝える情報（練習日程・出欠の回答先・ボウイング・録音など）を1か所にまとめ、管理者がブラウザから更新できるようにする。出欠の集計そのものは外部サービスに任せる。

**共通でやらないこと**

- 個人単位のアカウント、氏名・連絡先などの個人情報の保持（管理者メール1件は例外。詳細は認証・問い合わせの各節／機能設計）
- 複数団体への対応（1団体専用）
- 専用の定期実行基盤を前提にした運用（ログイン成功時掃除など、リクエスト内で完結する処理は可）

## 2. 用語とロール

| 用語 | 意味 |
| --- | --- |
| 演奏会 (concert) | 1回の本番とその準備期間。管理の最上位の単位 |
| 練習 (practice) | 演奏会に属する1回の練習日程 |
| 曲 (piece) | 演奏会で演奏する曲。ボウイングあり／なしの楽譜リンクを最大2つ持てる |
| 会場 (venue) | 練習や本番の場所。名前と住所を持つマスタ |
| 管理者 (admin) | すべてを更新できるロール |
| エキストラ (extra) | 参照のみのロール |

ロールは `admin` と `extra` の2つだけで、個人を識別しない。ロールごとに1本のパスワードを共有する。

| | 閲覧 | 更新 | パスワード変更 |
| --- | --- | --- | --- |
| admin | 可 | 可 | 可（両ロール分） |
| extra | 可 | 不可 | 不可 |

未ログインで見られるページはログイン画面のみ。想定規模はエキストラ数名・演奏会は年数回。データ量は数百行のオーダーを超えない。

## 3. 技術基盤

### 3.1 構成

単一リポジトリのアプリを Cloudflare Workers 1つとしてデプロイする。

| 層 | 採用技術 |
| --- | --- |
| フレームワーク | TanStack Start (React + TypeScript)、SPAモード |
| ルーティング | TanStack Router (ファイルベース) |
| UIコンポーネント | Mantine（用途固有のテーマ） |
| サーバ処理 | TanStack Start の server functions |
| ホスティング | Cloudflare Workers（無料プラン） |
| データベース | Cloudflare D1 (SQLite) |
| ORM / マイグレーション | Drizzle ORM + drizzle-kit |
| Lint / フォーマット | Biome |
| 単体テスト | Vitest |
| E2E テスト | Playwright |
| CI/CD | GitHub Actions（PRで検査、main で deploy） |
| 観測 | Workers Logs の構造化ログ。本番の Claude 本文は AI Gateway。詳細は [observability/design.md](../observability/design.md) |

`wrangler.jsonc` の `main` は自前の `src/server.ts` に向け、Start のリクエストハンドラを公開する（[ADR-0003](../adr/0003-wrap-start-fetch-in-worker-entry.md)）。`observability.enabled` は true（起動ログ）。Traces は載せない。

### 3.2 SPAモード

全ページ認証必須で SEO 不要のため SSR しない。ビルド時に SPA シェルを事前生成し、assets binding がシェルを返し、Worker は `/_serverFn/*` だけを受ける（[ADR-0008](../adr/0008-serve-spa-shell-from-assets-binding.md)）。

**帰結**: ルートの `beforeLoad` / `loader` に認可の強制力は無い。認証・認可の実体はサーバ関数の middleware で行う。

### 3.3 無料プランの制約

| 制約 | 値 | 設計上の対応 |
| --- | --- | --- |
| CPU 時間 / リクエスト | 10 ms | SSR しない。パスワードに反復型鍵導出を使わない |
| サブリクエスト / 呼び出し | 50 件（D1 も1件） | 一覧は一括クエリ。項目数に比例してクエリを増やさない |
| リクエスト数 | 100,000 / 日 | 数名利用では到達しない |
| D1 ストレージ | 5 GB | 数百行規模のため問題にならない |

逃げ道は Workers Paid（月$5）への変更とする。

### 3.4 時刻とタイムゾーン

- 練習の日付・時刻は日本時間の文字列として保持（`YYYY-MM-DD` / `HH:MM`）。TZ 変換しない
- 作成・更新時刻は UTC の ISO 8601
- 「今日」の判定は日本時間

### 3.5 データモデルの所在

現行スキーマの列定義は [archive/initial/design.md の6章](../archive/initial/design.md) に残している。**archive は凍結参照**（編集しない）。列や制約を変えるときは、先に当該機能の `design.md` か本文書へ移してから更新する。ルールや README で「archive が正」とは書かず、「未切り出しの凍結参照」と扱う。

## 4. 認証・認可

要約を本節に置き、**変更するときは本節を更新する**（archive の8章は凍結参照。食い違う場合は本節を正とする）。

未切り出しの細部（例: `last_seen_at` の間引き間隔、Cookie の `Path=/`、`login_attempts` の保持日数）は [archive/initial/design.md の8章](../archive/initial/design.md) を読んでよいが、それを変える必要が出たら本節へ移してから直す。

- ログインはパスワード1欄。admin / extra 両方のハッシュと照合し、一致したロールで入る
- ハッシュは `HMAC-SHA256(password, PEPPER)` を `hmac-sha256$v1$<hex>` で保存。`PEPPER` は Workers secret。定数時間比較
- 新しいパスワードは12文字以上。変更時は管理者の現在パスワードを要求し、変更したロールの全セッションを失効させる（[ADR-0013](../adr/0013-require-admin-password-to-change-passwords.md)）
- セッション Cookie は `__Host-oem_session`（HttpOnly / Secure / SameSite=Lax）。生トークンは Cookie のみ、DB には SHA-256。有効期限 30 日
- 同一 IP で直近5分の失敗が10回に達したら試行を拒否する。期限切れセッションと古い `login_attempts` の掃除はログイン成功時。専用 Cron は持たない
- **すべてのサーバ関数**が `requireAuth` または `requireAdmin` を通る。読み取りも例外にしない
- CSRF: `Sec-Fetch-Site`（無ければ `Origin`）検証を全サーバ関数に掛ける（[ADR-0006](../adr/0006-apply-csrf-middleware-to-all-server-functions.md)）

## 5. 環境変数・シークレット

| 名前 | 種別 | 用途 |
| --- | --- | --- |
| `PASSWORD_PEPPER` | secret | パスワードハッシュ用 pepper |
| `ADMIN_INITIAL_PASSWORD` | secret | 初期投入用。投入後は削除可 |
| `EXTRA_INITIAL_PASSWORD` | secret | 同上 |
| `DB` | D1 binding | データベース |
| `ANTHROPIC_API_KEY` | secret | AI案内の Claude API。機能仕様は [ai-assistant/design.md](../ai-assistant/design.md) |
| `ASSISTANT_STUB` | 任意（ローカル/CI） | `1` のとき Claude API を呼ばず決定的スタブを使う。本番では設定しない |
| `AI_GATEWAY_ACCOUNT_ID` | 設定 | 本番 Claude を AI Gateway 経由にするアカウント。未設定なら直結。仕様は [observability/design.md](../observability/design.md) |
| `AI_GATEWAY_ID` | 設定 | Gateway の id。未設定なら直結 |
| `AI_GATEWAY_TOKEN` | secret | 認証付き Gateway の Bearer。未設定なら直結 |

ローカルは `.dev.vars`、本番は `wrangler secret put`。機能固有の secret は当該機能の `design.md` に追記する。

## 6. テスト・CI/CD

- 単体: Vitest（node）。DB ロジックは `node:sqlite`（[ADR-0007](../adr/0007-test-db-logic-on-in-memory-sqlite.md)）
- E2E: Playwright。ローカル D1 を `--reset` で固定フィクスチャへ戻す（[ADR-0020](../adr/0020-reset-local-d1-for-e2e-fixtures.md)）
- PR で Lint・型・Vitest・Playwright。main マージでマイグレーション適用 → deploy（[ADR-0001](../adr/0001-split-ci-and-deploy-workflows.md)）
- マイグレーションは前方互換を保つ

## 7. 画面・機能仕様の所在

ルーティング、デザイン方針、お知らせ、問い合わせ、地図、カレンダーなどの機能仕様は、切り出し済みなら `docs/<feature>/design.md`、未切り出しなら [archive/initial/design.md](../archive/initial/design.md) を凍結参照する。

## 8. 運用上の任意判断（引き継ぎ）

初期案 tasks から引き継いだ、コード外の任意判断。

- [ ] **A-6** 独自ドメインを使うか決める。使わない場合は現在の `*.workers.dev` URLで運用を続ける

## 9. 決定記録（索引）

実装中の判断は `docs/adr/` に ADR として記録し、ここには索引の1行を置く。運用は [ADR-0000](../adr/0000-use-markdown-architectural-decision-records.md) が正。archive 側の旧14章は履歴であり更新しない。

| 決定 | 理由 | 詳細 |
| --- | --- | --- |
| Cloudflare Workers + D1 に一本化 | 無料枠に収まり、構成要素が最少 | — |
| SPAモード（SSRしない） | SEO 不要。CPU 10ms に対し SSR が最大リスク | — |
| 認証は共有パスワード2本 | 個人情報を持たない。個人識別が要件に無い | — |
| ハッシュは HMAC-SHA256 + pepper | CPU 10ms 下で反復型 KDF が使えない | — |
| 出欠リンクは演奏会に1つ | 外部サービスで全日程をまとめて回答する運用 | — |
| 曲の楽譜はあり／なし最大2リンク | ボウイング付きと無しを別 URL で渡す運用 | [ADR-0025](../adr/0025-dual-piece-score-links.md) |
| 会場はマスタ化 | 入力の手間と表記揺れを減らす | — |
| 練習の個別ページを作らない | 一覧内の展開で足りる | — |
| 実装中の判断は ADR に記録する | PR 説明に埋もれないようにする | [ADR-0000](../adr/0000-use-markdown-architectural-decision-records.md) |
| CI は PR、main は Deploy | 未検査コードを本番に出さない | [ADR-0001](../adr/0001-split-ci-and-deploy-workflows.md) |
| TypeScript 7 を採用 | 型チェックが速い | [ADR-0002](../adr/0002-adopt-typescript-7.md) |
| Worker エントリで Start の `fetch` をラップ | `env` の誤渡しを防ぐ | [ADR-0003](../adr/0003-wrap-start-fetch-in-worker-entry.md) |
| 列挙値はアプリ層で担保 | CHECK なしで拡張しやすくする | [ADR-0004](../adr/0004-enforce-enums-in-app-layer.md) |
| セッション照会はクライアントで1回 | 遷移ごとに D1 を増やさない | [ADR-0005](../adr/0005-cache-session-lookup-on-client.md) |
| CSRF は全サーバ関数 | 付け忘れを防ぐ | [ADR-0006](../adr/0006-apply-csrf-middleware-to-all-server-functions.md) |
| DB 単体テストは `node:sqlite` | SQL 意味論を軽く検証する | [ADR-0007](../adr/0007-test-db-logic-on-in-memory-sqlite.md) |
| SPA シェルは assets binding | Worker はサーバ関数のみ | [ADR-0008](../adr/0008-serve-spa-shell-from-assets-binding.md) |
| 選択中演奏会は URL クエリを正 | loader 再実行につなげる | [ADR-0009](../adr/0009-canonicalize-selected-concert-in-url.md) |
| 削除確認はネイティブ `<dialog>` | 対象ごとの文言を出せる | [ADR-0010](../adr/0010-confirm-deletions-with-native-dialog.md) |
| `sort_order` は密な連番 | サブリクエスト上限を守る | [ADR-0011](../adr/0011-keep-sort-order-dense.md) |
| URL差し替えで旧検知結果を捨てる | 直したリンクが要確認のまま残らない | [ADR-0012](../adr/0012-drop-link-check-on-url-change.md) |
| パスワード変更に管理者パスワード | 放置端末からの書き換えを防ぐ | [ADR-0013](../adr/0013-require-admin-password-to-change-passwords.md) |
| リンク切れ検知を見送り | 日常利用の導線を優先 | [ADR-0014](../adr/0014-prioritize-portal-usability-over-link-checking.md) |
| Mantine を用途固有テーマで使う | CRUD 再利用と画一化回避 | [ADR-0015](../adr/0015-adopt-mantine-with-purpose-built-theme.md) |
| カレンダーURLは日本時間文字列から組み立て | TZ ずれを避ける | [ADR-0016](../adr/0016-build-calendar-links-with-local-date-strings.md) |
| ダッシュボードは次の練習を最上位 | 開いてすぐ日時へ届く | [ADR-0017](../adr/0017-departure-board-dashboard-layout.md) |
| 閲覧UIは実用コンパクト | 密度と読みやすさの両立 | [ADR-0018](../adr/0018-compact-utility-visual-language.md) |
| PCは上部アプリバー型シェル | 情報ポータル向けの横タブ | [ADR-0019](../adr/0019-desktop-top-app-bar-shell.md) |
| E2E はローカル D1 を `--reset` | 再実行で結果が変わらない | [ADR-0020](../adr/0020-reset-local-d1-for-e2e-fixtures.md) |
| 外部リンク視認性＋管理行操作のアイコン化 | 受け入れ改善を共通部品で直す | [ADR-0021](../adr/0021-visible-external-links-and-compact-admin-row-actions.md) |
| 演奏会お知らせは通知・既読なし | ホーム再訪の理由を最小構成で | [ADR-0022](../adr/0022-add-concert-announcements-without-notifications.md) |
| 設計・タスクは機能ディレクトリ単位 | 初期案の単一 design/tasks をやめ、機能ごとに正を置く | [ADR-0023](../adr/0023-feature-directory-design-and-tasks.md) |
| CS 自動同期を見送り練習一括作成にする | API/CSV 不可・iCal は会場不足。ポータル内で登録負荷を下げる | [ADR-0024](../adr/0024-prefer-bulk-practice-create-over-circle-square-sync.md) |
| 曲の楽譜リンクをあり／なしの2本にする | 既存 `bowing_url` を残しつつ無し側を追加 | [ADR-0025](../adr/0025-dual-piece-score-links.md) |
| 練習一括はトグル・行複製・会場 modal 即保存 | 普段は隠し、似た行をコピーし、会場はマスタとして即確定する | [ADR-0026](../adr/0026-bulk-practice-toggle-duplicate-and-venue-modal.md) |
| 次の練習検索は質問語句を無視し今日を明示する | 1回の tool use で候補質問が空にならないようにする | [ADR-0027](../adr/0027-assistant-next-practice-search.md) |
| アプリログは Workers Logs、LLM 本文は AI Gateway | 無料枠内で失敗と品質を分けて追う。Langfuse と Traces は見送り | [ADR-0028](../adr/0028-workers-logs-and-ai-gateway-observability.md) |
