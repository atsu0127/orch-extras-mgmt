# オーケストラ エキストラ管理ポータル 設計書

最終更新: 2026-07-25

## 1. 目的と背景

オーケストラの演奏会でエキストラ（客演奏者）に情報を伝える作業が、個別連絡に頼っているため手間になっている。練習日程・出欠の回答先・ボウイング・練習の録音を1か所にまとめて公開し、エキストラが自分で見に行ける状態を作る。

このアプリが解決するのは「情報の置き場所が散らばっていること」だけである。出欠の集計そのものは既存の外部サービス（調整さん等）を使い続ける。

## 2. スコープ

**やること**

- 練習日程の一覧公開（日付・時刻・会場・フリーテキストの詳細）
- 出欠回答先（外部サービス）へのリンク表示
- 練習ごとの録音・録画リンクの公開
- 曲ごとのボウイングリンクの公開
- ボウイングリンクの死活を毎日自動チェックし、状態が変わったら Slack に通知
- 管理者がブラウザ上で上記すべてを更新できる管理画面
- 演奏会単位の管理と、演奏会の切り替え

**やらないこと**

- 出欠の入力・集計（外部サービスに任せる）
- 楽譜や音源そのものの保管（外部ストレージのリンクを貼るだけ）
- 個人単位のアカウント、氏名・連絡先などの個人情報の保持
- 複数のオーケストラ団体への対応（1団体専用）
- メール通知、監査ログ、権限の細分化

## 3. 用語

| 用語 | 意味 |
| --- | --- |
| 演奏会 (concert) | 1回の本番とその準備期間。管理の最上位の単位 |
| 練習 (practice) | 演奏会に属する1回の練習日程 |
| 曲 (piece) | 演奏会で演奏する曲。ボウイングリンクを1つ持つ |
| ボウイング | 弓の上げ下げを記した資料。外部ストレージ上のファイルへのリンクとして扱う |
| 会場 (venue) | 練習や本番の場所。名前と住所を持つマスタ |
| 管理者 (admin) | すべてを更新できるロール |
| エキストラ (extra) | 参照のみのロール |

## 4. 利用者とロール

ロールは `admin` と `extra` の2つだけで、個人を識別しない。ロールごとに1本のパスワードを共有して使う。

| | 閲覧 | 更新 | パスワード変更 |
| --- | --- | --- | --- |
| admin | 可 | 可 | 可（両ロール分） |
| extra | 可 | 不可 | 不可 |

未ログインで見られるページはログイン画面のみ。トップページも認証必須とする（リンクが検索エンジンや第三者に渡らないようにするため）。

想定規模はエキストラ5名前後、1団体、演奏会は年数回。データ量は数百行のオーダーを超えない。

## 5. 技術基盤

### 5.1 構成

単一リポジトリのアプリを Cloudflare Workers 1つとしてデプロイする。画面・サーバ関数・定期実行がすべて同じコードベースと同じデプロイ単位に収まる。

| 層 | 採用技術 |
| --- | --- |
| フレームワーク | TanStack Start (React + TypeScript)、SPAモード |
| ルーティング | TanStack Router (ファイルベース) |
| サーバ処理 | TanStack Start の server functions |
| ホスティング | Cloudflare Workers（無料プラン） |
| データベース | Cloudflare D1 (SQLite) |
| ORM / マイグレーション | Drizzle ORM + drizzle-kit |
| 定期実行 | Cloudflare Cron Triggers（`server.ts` の scheduled ハンドラ） |
| 通知 | Slack Incoming Webhook |
| ランタイム管理 | mise で Node 24 系 / pnpm を固定 |
| Lint / フォーマット | Biome |
| 単体テスト | Vitest |
| E2E テスト | Playwright |
| CI/CD | GitHub Actions（PRで検査、main で deploy） |

Vite の設定は Cloudflare 公式プラグインと Start プラグインを併用する。

```ts
// vite.config.ts
export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart({ spa: { enabled: true } }),
    viteReact(),
  ],
})
```

`wrangler.jsonc` では `main` を `@tanstack/react-start/server-entry` ではなく自前の `src/server.ts` に向け、Start のリクエストハンドラに加えて `scheduled` ハンドラを公開する。

### 5.2 SPAモードを選ぶ理由と影響

全ページがログイン必須で SEO が不要、利用者も数名という条件下では、サーバサイドレンダリングの利点がほぼない。一方で無料プランの CPU 制限（後述）に対して SSR は最も重い処理になる。よってビルド時にアプリのシェル（`/_shell.html`）だけを事前生成し、Worker の仕事をサーバ関数の実行と静的資産の配信に絞る。

**重要な帰結**: SPAモードではルートの `beforeLoad` と `loader` がサーバで実行されない。つまり**ルート側の認証ガードは体験を整えるためのものにすぎず、権限の強制力を持たない**。認証と認可の実体は必ずサーバ関数側の middleware で行う（8章）。

### 5.3 無料プランの制約と、それに対する設計

| 制約 | 値 | 設計上の対応 |
| --- | --- | --- |
| CPU 時間 / リクエスト | 10 ms | SPAモードで SSR を行わない。パスワードハッシュに重い鍵導出関数を使わない（8.2） |
| CPU 時間 / Cron 実行 | 10 ms | ネットワーク待ちは CPU 時間に含まれないため、リンクチェックは待ち時間が主で問題にならない。レスポンス本文の解析は先頭部分のみに限る |
| サブリクエスト / 呼び出し | 50 件（D1 クエリも1件として数える） | Cron 1回で扱うリンクを 40 件までに制限（9.3） |
| リクエスト数 | 100,000 / 日 | 数名の利用では到達しない |
| Cron Triggers | 5 個 / アカウント | 1個だけ使う |
| D1 ストレージ | 5 GB、読み取り 500 万行/日 | 数百行規模のため問題にならない |

CPU 制限に「稀な超過は許容される」猶予はあるが、恒常的に超えると実行が打ち切られる。将来 SSR が必要になった場合や制限に触れた場合の逃げ道は Workers Paid（月$5）への変更とする。

### 5.4 時刻とタイムゾーンの扱い

- 練習の日付・時刻は日本時間の文字列としてそのまま保持する（`date`: `YYYY-MM-DD`、`start_time`/`end_time`: `HH:MM`）。タイムゾーン変換は行わない
- レコードの作成・更新時刻は UTC の ISO 8601 文字列で保持する
- 「今日」の判定は日本時間で行う（一覧の今後／過去の切り分けに使う）
- Cron は `0 0 * * *`（UTC）= 日本時間 9:00 に実行する

## 6. データモデル

D1 (SQLite) 上の9テーブル。Drizzle でスキーマを定義し、`drizzle-kit` が生成した SQL を `wrangler d1 migrations apply` で適用する。

### 6.1 テーブル定義

**venues** — 会場マスタ

| 列 | 型 | 制約 | 備考 |
| --- | --- | --- | --- |
| id | integer | PK, autoincrement | |
| name | text | not null, 100文字以内 | 例: 〇〇市民会館 大練習室 |
| address | text | not null, 200文字以内 | |
| note | text | null, 500文字以内 | アクセスの補足など |
| created_at / updated_at | text | not null | UTC ISO 8601 |

**concerts** — 演奏会

| 列 | 型 | 制約 | 備考 |
| --- | --- | --- | --- |
| id | integer | PK, autoincrement | |
| name | text | not null, 100文字以内 | |
| performance_date | text | null | 本番日 `YYYY-MM-DD` |
| venue_id | integer | null, FK venues(id) ON DELETE SET NULL | 本番会場 |
| attendance_url | text | null, URL検証あり | 出欠回答先。演奏会に1つ |
| attendance_note | text | null, 500文字以内 | 回答期限などの補足 |
| status | text | not null, `active` \| `archived`, 既定 `active` | |
| created_at / updated_at | text | not null | |

**practices** — 練習日程

| 列 | 型 | 制約 | 備考 |
| --- | --- | --- | --- |
| id | integer | PK, autoincrement | |
| concert_id | integer | not null, FK concerts(id) ON DELETE CASCADE | |
| date | text | not null | `YYYY-MM-DD` |
| start_time / end_time | text | null | `HH:MM` |
| venue_id | integer | null, FK venues(id) ON DELETE SET NULL | |
| detail | text | null, 2000文字以内 | スケジュール等のフリーテキスト。改行を保持して表示 |
| created_at / updated_at | text | not null | |

索引: `(concert_id, date)`

**practice_media** — 練習の録音・録画リンク

| 列 | 型 | 制約 | 備考 |
| --- | --- | --- | --- |
| id | integer | PK, autoincrement | |
| practice_id | integer | not null, FK practices(id) ON DELETE CASCADE | |
| title | text | not null, 100文字以内 | 例: 1楽章 通し |
| url | text | not null, URL検証あり | |
| sort_order | integer | not null, 既定 0 | |
| created_at / updated_at | text | not null | |

索引: `(practice_id, sort_order)`

**pieces** — 曲とボウイング

| 列 | 型 | 制約 | 備考 |
| --- | --- | --- | --- |
| id | integer | PK, autoincrement | |
| concert_id | integer | not null, FK concerts(id) ON DELETE CASCADE | |
| title | text | not null, 100文字以内 | |
| composer | text | null, 100文字以内 | |
| sort_order | integer | not null, 既定 0 | 演奏順 |
| bowing_url | text | null, URL検証あり | 1曲1リンク |
| created_at / updated_at | text | not null | |

索引: `(concert_id, sort_order)`

**link_checks** — リンクチェックの最新結果

| 列 | 型 | 制約 | 備考 |
| --- | --- | --- | --- |
| id | integer | PK, autoincrement | |
| target_type | text | not null, 現状は `bowing` のみ | 将来 `practice_media` を追加できる |
| target_id | integer | not null | 対象レコードの id |
| url | text | not null | チェック時点の URL |
| verdict | text | not null, `ok` \| `broken` \| `suspect` \| `error` | 9.2 参照 |
| http_status | integer | null | |
| detail | text | null | 判定理由（例: `redirected to accounts.google.com`） |
| checked_at | text | not null | UTC ISO 8601 |

一意制約: `(target_type, target_id)` — 対象ごとに最新1件のみを保持し、履歴は残さない。

**credentials** — ロールごとの認証情報（2行のみ）

| 列 | 型 | 制約 | 備考 |
| --- | --- | --- | --- |
| role | text | PK, `admin` \| `extra` | |
| password_hash | text | not null | 形式 `hmac-sha256$v1$<hex>` |
| updated_at | text | not null | |

**sessions** — ログインセッション

| 列 | 型 | 制約 | 備考 |
| --- | --- | --- | --- |
| id | text | PK | セッショントークンの SHA-256 hex。生トークンは保存しない |
| role | text | not null | |
| created_at / expires_at / last_seen_at | text | not null | UTC ISO 8601 |

索引: `expires_at`

**login_attempts** — ログイン試行（レート制限用）

| 列 | 型 | 制約 | 備考 |
| --- | --- | --- | --- |
| id | integer | PK, autoincrement | |
| ip | text | not null | `CF-Connecting-IP` |
| attempted_at | text | not null | |
| success | integer | not null, 既定 0 | 0/1 |

索引: `(ip, attempted_at)`

### 6.2 関連

```
venues ─┬─(本番会場)─ concerts ─┬─ practices ─ practice_media
        └─(練習会場)─ practices └─ pieces ─(bowing_url)─ link_checks
```

`concerts` を削除すると配下の `practices`・`practice_media`・`pieces` も削除される。`venues` は削除しても練習は残り、会場が未設定になる（過去の練習記録を失わないため）。`link_checks` は対象が消えた時点で孤児になるため、Cron 実行時にまとめて掃除する。

### 6.3 入力検証の方針

すべてのサーバ関数の入力を zod で検証する。URL は `http://` または `https://` で始まるものだけを許可し（`javascript:` などを排除）、2000文字以内とする。文字列の長さ上限は上表のとおり。

## 7. 画面とルーティング

スマートフォン優先のカードUI、日本語のみ、OS 設定に追従するライト／ダークテーマ。

| パス | ロール | 内容 |
| --- | --- | --- |
| `/login` | 未ログイン | パスワード入力欄1つとログインボタン |
| `/` | 全 | ダッシュボード。次の練習1件、出欠リンク、各一覧への導線 |
| `/practices` | 全 | 練習日程一覧。「今後」「過去」を切り替え。各練習に会場・詳細・録音リンク |
| `/pieces` | 全 | 曲一覧とボウイングリンク |
| `/admin` | admin | 管理トップ。要確認リンクの一覧、最終チェック日時、手動チェック |
| `/admin/concerts` | admin | 演奏会の作成・編集・アーカイブ・削除 |
| `/admin/venues` | admin | 会場マスタの作成・編集・削除 |
| `/admin/practices` | admin | 練習の作成・編集・削除、録音リンクの追加・並べ替え・削除 |
| `/admin/pieces` | admin | 曲の作成・編集・並べ替え・削除、ボウイングURLの設定 |
| `/admin/settings` | admin | 両ロールのパスワード変更 |

一覧は行数が少ない想定なのでページングを設けない。練習の詳細は一覧内で展開して見せ、個別ページを作らない。

### 7.1 演奏会の切り替え

ヘッダに演奏会セレクタを置く。選択中の演奏会は URL のクエリパラメータ `?concert=<id>` を正とし、指定がない場合は次の順で解決する。

1. Cookie `oem_concert` に前回の選択があり、その演奏会が存在すればそれ
2. `status = 'active'` のうち `performance_date` が最も近い将来のもの
3. それも無ければ最新に作られた演奏会

セレクタは進行中とアーカイブ済みを区別して表示する。演奏会が1件も無い場合、閲覧側は「まだ公開された演奏会がありません」と表示し、管理者には演奏会作成への導線を出す。

## 8. 認証・認可設計

### 8.1 ログイン

ログイン画面の入力欄はパスワード1つだけ。入力値を admin と extra 両方のハッシュと照合し、一致した側のロールでログインさせる。ロールを選ばせないので利用者が迷わず、また常に両方を計算するので処理時間の差からロールを推測されることもない。

### 8.2 パスワードの保存形式

`HMAC-SHA256(password, PEPPER)` の16進文字列を `hmac-sha256$v1$<hex>` の形式で保存する。`PEPPER` は Workers の secret として保持し、DB には置かない。

この選択の理由は、無料プランの CPU 制限（10ms）に対して PBKDF2 や Argon2 のような反復の多い鍵導出関数が収まらないこと。今回の脅威モデルでは、守る対象は個人情報ではなく共有パスワード2本であり、想定する最悪ケースは D1 の内容が漏れることである。pepper が Workers 側にあるため、DB 単体からはオフライン総当たりができない。加えて 8.4 のレート制限でオンライン総当たりを抑える。

先頭にアルゴリズム識別子を含めるので、Workers Paid に移行した場合や個人アカウントを導入する場合に、検証時のフォールバックを使って段階的に強い方式へ移行できる。

比較には一致・不一致で処理時間が変わらない定数時間比較を使う。

### 8.3 セッション

- ログイン成功時に 32 バイトの乱数トークンを生成し、その SHA-256 を `sessions.id` として保存する。生トークンは Cookie にのみ入れる
- Cookie は `__Host-oem_session`。`HttpOnly` / `Secure` / `SameSite=Lax` / `Path=/`、有効期限 30 日
- リクエストごとにトークンをハッシュして DB を引き、`expires_at` が未来であることを確認する
- `last_seen_at` の更新と有効期限の延長は 1 日に 1 回程度に間引き、D1 への書き込みを節約する
- ログアウトで該当セッションを削除する。パスワードを変更したら、そのロールの全セッションを失効させる
- 期限切れセッションは Cron 実行時にまとめて削除する

### 8.4 認可の強制

SPAモードのため画面側のガードは強制力を持たない。したがって次の二層で守る。

1. **サーバ関数の middleware**（実体）: `requireAuth`（セッション必須）と `requireAdmin`（さらに `role = 'admin'` 必須）を用意し、**すべてのサーバ関数がどちらかを必ず通る**ようにする。読み取り系も例外にしない
2. **ルートの `beforeLoad`**（体験）: 未ログインならログイン画面へ、`extra` が管理画面を開いたらダッシュボードへ、クライアント側で誘導する

### 8.5 その他の防御

- **ログインのレート制限**: 同一 IP（`CF-Connecting-IP`）で直近5分の失敗が10回に達したら、以後の試行を一定時間拒否する。`login_attempts` の古い行は Cron で掃除する
- **CSRF**: Cookie が `SameSite=Lax` なので他サイトからの POST では送信されない。加えて更新系サーバ関数では `Origin` ヘッダが自サイトと一致することを確認する
- **秘密情報の扱い**: 環境変数は `cloudflare:workers` の binding からリクエストごとに読む（モジュール読み込み時に読むとクライアントバンドルへ混入する恐れがあるため）
- **レスポンスヘッダ**: `X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、外部リンクは `rel="noopener noreferrer"`

## 9. リンク切れ検知

### 9.1 対象と頻度

`status = 'active'` の演奏会に属する曲の `bowing_url`（非空のもの）を、毎日 9:00（日本時間）に1回チェックする。アーカイブ済み演奏会は対象外。管理画面から手動実行もできる（同一ロジック）。

### 9.2 判定

各 URL に対して、まず `HEAD` を投げ、405 などで拒否されたら `Range: bytes=0-2047` を付けた `GET` にフォールバックする。リダイレクトは追跡し、タイムアウトは10秒。

| verdict | 条件 |
| --- | --- |
| `ok` | 2xx が返り、後述の兆候が無い |
| `broken` | 4xx / 5xx が返る（404, 403, 410 など） |
| `suspect` | 2xx だが、最終 URL が認証画面（`accounts.google.com` 等）に変わっている、または HTML 本文の先頭にログイン要求・アクセス権要求・削除済みを示す文言がある |
| `error` | タイムアウト、名前解決失敗、その他のネットワーク例外 |

Google Drive などは権限エラーでも 200 を返すことがあるため、この検知は「取りこぼしが無いことを保証するもの」ではなく「疑わしいものを拾い上げるもの」である。`suspect` は誤検知もあり得る前提で、管理者が目視確認する運用とする。

### 9.3 サブリクエスト上限への対応

無料プランでは1回の実行で D1 クエリも含めて50サブリクエストまで。そこで1回の実行で扱うリンクを **40件まで**とし、`link_checks.checked_at` が古いもの（未チェックを最優先）から処理する。件数が上限を超えても翌日以降に順次回るため、全体は数日で一巡する。現状の規模（十数件）では毎日全件が回る。

内訳の目安: 対象取得1 + リンク40 + 結果の一括書き込み1〜2 + Slack送信1 = 44前後。

### 9.4 通知

Slack Incoming Webhook に送る。**前回の verdict から変化したときだけ**送信する。毎日同じ内容が届くと読まれなくなるためである。

- `ok` → `broken` / `suspect` / `error`: 異常として通知
- `broken` / `suspect` / `error` → `ok`: 復旧として通知
- 異常間の遷移（例 `error` → `broken`）: 通知しない
- 初回チェックで異常だった場合は通知する

1回の実行で複数の変化があれば1通にまとめる。本文には演奏会名・曲名・URL・判定・HTTPステータス・管理画面へのリンクを含める。Webhook URL が未設定なら通知を飛ばさず、結果の保存だけ行う（管理画面では引き続き確認できる）。

### 9.5 Cron 実行時のついで処理

同じ scheduled ハンドラで次の掃除も行う。いずれも1〜2クエリで済む。

- 期限切れセッションの削除
- 7日より古い `login_attempts` の削除
- 対象レコードが存在しない `link_checks` の削除

## 10. 環境変数・シークレット

| 名前 | 種別 | 用途 |
| --- | --- | --- |
| `PASSWORD_PEPPER` | secret | パスワードハッシュ用の pepper |
| `SLACK_WEBHOOK_URL` | secret | 通知先。未設定なら通知しない |
| `ADMIN_INITIAL_PASSWORD` | secret | 初期投入用。投入後は削除してよい |
| `EXTRA_INITIAL_PASSWORD` | secret | 同上 |
| `APP_BASE_URL` | 変数 | Slack 通知に載せる管理画面リンクの組み立てに使う |
| `DB` | D1 binding | データベース |

secret は `wrangler secret put` で設定する。ローカル開発では `.dev.vars`（gitignore 対象）に置く。`PASSWORD_PEPPER` を変えると既存パスワードが検証できなくなるため、変更時はパスワードの再設定が必要である。

## 11. テスト方針

**Vitest（単体）** — サーバ側のロジックを対象にする。

- パスワードのハッシュ生成・検証（正しい／誤ったパスワード、定数時間比較、形式の後方互換）
- セッションの発行・検証・期限切れ・失効
- ログインのレート制限判定
- リンク判定ロジック（2xx、4xx、リダイレクト先が認証画面、本文の文言、タイムアウト）— `fetch` をモックする
- 通知するかどうかの遷移判定（変化あり／なし／初回）
- 練習一覧の今後・過去の切り分けと並び順（日本時間の日付境界）
- 演奏会の選択解決順序
- 入力検証（URL スキーム、文字数上限）

**Playwright（E2E）** — 主要導線を2本に絞る。

1. エキストラのパスワードでログインし、練習日程と曲・ボウイングリンクが見えることを確認する
2. 管理者のパスワードでログインし、会場・演奏会・練習を作成し、閲覧側の一覧に反映されることを確認する

E2E はローカルの D1（wrangler のローカルモード）に対して実行する。

## 12. CI/CD と環境

- 環境は本番のみ。プレビュー環境は必要になってから検討する
- GitHub Actions: PR で Lint・型チェック・Vitest を実行する。E2E が整備できた段階で Playwright も PR の検査に加える
- main ブランチへのマージで `wrangler d1 migrations apply`（本番）→ `wrangler deploy` を実行する
- デプロイに使う Cloudflare API トークンは GitHub Secrets に置く
- マイグレーションは前方互換を保つ（列の削除やリネームは、追加→移行→削除の順に分ける）。バックアップは D1 の `wrangler d1 export` を必要時に手動で取る

## 13. 将来の拡張候補

いま作らないが、データモデルの都合で入口だけ用意してあるもの。

- 録音リンクもリンクチェックの対象にする（`link_checks.target_type` に `practice_media` を追加するだけで済む）
- 1曲に複数のボウイングリンク（パート別）を持たせる（`pieces.bowing_url` を別テーブルに切り出す）
- メール通知の追加（通知処理を差し替え可能な形にしておく）
- パスワードハッシュのより強い方式への移行（形式にバージョン識別子があるため段階移行できる）

## 14. 決定記録

決定の一覧。実装中に行った判断は `docs/adr/` に ADR として1件1ファイルで記録し、ここには索引の1行だけを置く。書き方と運用は [ADR-0000](./adr/0000-use-markdown-architectural-decision-records.md) が正。

| 決定 | 理由 | 詳細 |
| --- | --- | --- |
| Cloudflare Workers + D1 に一本化 | 無料枠に収まり、cron が標準機能で、構成要素が最少になる | — |
| SPAモード（SSRしない） | 全ページ認証必須で SEO 不要。無料プランの CPU 10ms 制限に対して SSR が最大のリスク要因 | — |
| 認証は共有パスワード2本 | 個人情報を持たない方針。個人単位の識別が要件に無い | — |
| ハッシュは HMAC-SHA256 + pepper | CPU 10ms 制限下で反復型の鍵導出関数が使えない。DB 単体の漏洩では総当たりできない構成にする | — |
| 通知先は Slack | メールより設定が簡単で無料。要件の「管理者に連絡」を満たす | — |
| 通知は状態変化時のみ | 毎日同じ通知は読まれなくなる | — |
| 出欠リンクは演奏会に1つ | 外部サービスで全日程をまとめて回答する運用に合わせる | — |
| ボウイングは1曲1リンク | 現状の共有方法に合わせ、パート別は将来の拡張とする | — |
| 会場はマスタ化 | 同じ会場を繰り返し使うため、入力の手間と表記揺れを減らす | — |
| 練習の個別ページを作らない | 件数が少なく、一覧内の展開で足りる | — |
| 実装中の判断は ADR に記録する | 代替案と、その決定で犠牲にしたものが PR の説明に埋もれるのを防ぐ | [ADR-0000](./adr/0000-use-markdown-architectural-decision-records.md) |
| CI は PR だけで動かし、main への push は Deploy が検査も兼ねる | 検査を通っていないコードが本番に出ないことを、ワークフローをまたがずに保証する | [ADR-0001](./adr/0001-split-ci-and-deploy-workflows.md) |
| TypeScript 7（ネイティブ実装）を採用 | 型チェックが速い。新規プロジェクトなので 5.x への差し戻しが容易 | [ADR-0002](./adr/0002-adopt-typescript-7.md) |
| Worker のエントリで Start の `fetch` をラップする | Workers の `env` が Start のオプション引数として渡るのを防ぐ | [ADR-0003](./adr/0003-wrap-start-fetch-in-worker-entry.md) |
| 列挙値は CHECK 制約ではなくアプリ層で担保する | 13章の `target_type` 追加を、テーブル再作成なしで行えるようにする | [ADR-0004](./adr/0004-enforce-enums-in-app-layer.md) |
