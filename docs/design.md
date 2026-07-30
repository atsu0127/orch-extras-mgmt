# オーケストラ エキストラ管理ポータル 設計書

最終更新: 2026-07-30

## 1. 目的と背景

オーケストラの演奏会でエキストラ（客演奏者）に情報を伝える作業が、個別連絡に頼っているため手間になっている。練習日程・出欠の回答先・ボウイング・練習の録音を1か所にまとめて公開し、エキストラが自分で見に行ける状態を作る。

このアプリが解決するのは「情報の置き場所が散らばっていること」だけである。出欠の集計そのものは既存の外部サービス（調整さん等）を使い続ける。

## 2. スコープ

**やること**

- 練習日程の一覧公開（日付・時刻・会場・フリーテキストの詳細）
- 出欠回答先（外部サービス）へのリンク表示
- 練習ごとの録音・録画リンクの公開
- 曲ごとのボウイングリンクの公開
- 演奏会の備考と、しおりなどの資料リンクの公開
- 管理者のメールアドレスを登録し、エキストラが端末のメールアプリから問い合わせられる導線
- 会場を地図で開く導線と、本番・練習を Google カレンダーへ追加する導線
- 管理者がブラウザ上で上記すべてを更新できる管理画面
- 演奏会単位の管理と、演奏会の切り替え
- 練習を複製して、繰り返し入力する手間を減らす

**やらないこと**

- 出欠の入力・集計（外部サービスに任せる）
- 楽譜や音源そのものの保管（外部ストレージのリンクを貼るだけ）
- 個人単位のアカウント、氏名・連絡先などの個人情報の保持
- 複数のオーケストラ団体への対応（1団体専用）
- アプリからのメール送信、メール通知、問い合わせ履歴の保持
- リンク切れの自動検知、Slack 通知
- 監査ログ、権限の細分化

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

単一リポジトリのアプリを Cloudflare Workers 1つとしてデプロイする。画面とサーバ関数が同じコードベースと同じデプロイ単位に収まる。

| 層 | 採用技術 |
| --- | --- |
| フレームワーク | TanStack Start (React + TypeScript)、SPAモード |
| ルーティング | TanStack Router (ファイルベース) |
| UIコンポーネント | Mantine（用途固有のテーマを定義） |
| サーバ処理 | TanStack Start の server functions |
| ホスティング | Cloudflare Workers（無料プラン） |
| データベース | Cloudflare D1 (SQLite) |
| ORM / マイグレーション | Drizzle ORM + drizzle-kit |
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

`wrangler.jsonc` では `main` を `@tanstack/react-start/server-entry` ではなく自前の `src/server.ts` に向け、Start のリクエストハンドラを公開する。

### 5.2 SPAモードを選ぶ理由と影響

全ページがログイン必須で SEO が不要、利用者も数名という条件下では、サーバサイドレンダリングの利点がほぼない。一方で無料プランの CPU 制限（後述）に対して SSR は最も重い処理になる。よってビルド時にアプリのシェル（`dist/client/index.html`）だけを事前生成し、Worker の仕事をサーバ関数の実行に絞る。

シェルの配信は Cloudflare の assets binding が行い、Worker には `/_serverFn/*` だけを回す。この振り分けは `wrangler.jsonc` の `assets` で設定する（[ADR-0008](./adr/0008-serve-spa-shell-from-assets-binding.md)）。設定を外すと document ごとに Worker が描画してしまい、以下の前提が崩れる。

**重要な帰結**: SPAモードではルートの `beforeLoad` と `loader` がサーバで実行されない。つまり**ルート側の認証ガードは体験を整えるためのものにすぎず、権限の強制力を持たない**。認証と認可の実体は必ずサーバ関数側の middleware で行う（8章）。

### 5.3 無料プランの制約と、それに対する設計

| 制約 | 値 | 設計上の対応 |
| --- | --- | --- |
| CPU 時間 / リクエスト | 10 ms | SPAモードで SSR を行わない。パスワードハッシュに重い鍵導出関数を使わない（8.2） |
| サブリクエスト / 呼び出し | 50 件（D1 クエリも1件として数える） | 一覧取得や並べ替えは一括クエリを使い、項目数に比例してクエリを増やさない |
| リクエスト数 | 100,000 / 日 | 数名の利用では到達しない |
| D1 ストレージ | 5 GB、読み取り 500 万行/日 | 数百行規模のため問題にならない |

CPU 制限に「稀な超過は許容される」猶予はあるが、恒常的に超えると実行が打ち切られる。将来 SSR が必要になった場合や制限に触れた場合の逃げ道は Workers Paid（月$5）への変更とする。

### 5.4 時刻とタイムゾーンの扱い

- 練習の日付・時刻は日本時間の文字列としてそのまま保持する（`date`: `YYYY-MM-DD`、`start_time`/`end_time`: `HH:MM`）。タイムゾーン変換は行わない
- レコードの作成・更新時刻は UTC の ISO 8601 文字列で保持する
- 「今日」の判定は日本時間で行う（一覧の今後／過去の切り分けに使う）

## 6. データモデル

D1 (SQLite) 上の11テーブル。Drizzle でスキーマを定義し、`drizzle-kit` が生成した SQL を `wrangler d1 migrations apply` で適用する。

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
| note | text | null, 2000文字以内 | 集合・服装など演奏会全体の備考。改行を保持して表示 |
| status | text | not null, `active` \| `archived`, 既定 `active` | |
| created_at / updated_at | text | not null | |

**concert_resources** — しおりなどの演奏会資料リンク

| 列 | 型 | 制約 | 備考 |
| --- | --- | --- | --- |
| id | integer | PK, autoincrement | |
| concert_id | integer | not null, FK concerts(id) ON DELETE CASCADE | |
| title | text | not null, 100文字以内 | 例: 演奏会のしおり |
| url | text | not null, URL検証あり | |
| sort_order | integer | not null, 既定 0 | |
| created_at / updated_at | text | not null | |

索引: `(concert_id, sort_order)`。1演奏会につき最大5件とし、アプリ層で登録時に上限を検証する。

**app_settings** — 団体共通の設定（1行のみ）

| 列 | 型 | 制約 | 備考 |
| --- | --- | --- | --- |
| id | integer | PK | 常に1 |
| admin_email | text | null, 254文字以内、メール形式検証あり | 問い合わせ先。管理者本人のアドレスを格納する例外 |
| created_at / updated_at | text | not null | |

管理者メール以外の個人情報は持たない。エキストラの氏名・メールアドレスや問い合わせ本文は保存しない。
初期行は必須にせず、行が無ければ未設定として扱う。設定画面から保存するときに `id = 1` で upsert し、空欄の保存は `admin_email = null` として問い合わせ導線を解除する。管理者としてログイン済みであれば変更でき、パスワードの再入力は求めない。

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

初期設計で作成済みだが、リンク切れ検知を今回のスコープから外したため使用しない。適用済みマイグレーションを巻き戻すための破壊的変更は行わず、将来の拡張用としてテーブルだけ残す。

| 列 | 型 | 制約 | 備考 |
| --- | --- | --- | --- |
| id | integer | PK, autoincrement | |
| target_type | text | not null, 現状は `bowing` のみ | 将来 `practice_media` を追加できる |
| target_id | integer | not null | 対象レコードの id |
| url | text | not null | チェック時点の URL |
| verdict | text | not null, `ok` \| `broken` \| `suspect` \| `error` | 初期設計の判定値。今回は使用しない |
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
app_settings
venues ─┬─(本番会場)─ concerts ─┬─ practices ─ practice_media
        └─(練習会場)─ practices ├─ pieces
                                  └─ concert_resources
```

`concerts` を削除すると配下の `practices`・`practice_media`・`pieces`・`concert_resources` も削除される。`venues` は削除しても練習は残り、会場が未設定になる（過去の練習記録を失わないため）。未使用の `link_checks` にデータは作成しない。

### 6.3 入力検証の方針

すべてのサーバ関数の入力を zod で検証する。URL は `http://` または `https://` で始まるものだけを許可し（`javascript:` などを排除）、2000文字以内とする。文字列の長さ上限は上表のとおり。

## 7. 画面とルーティング

スマートフォン優先、日本語のみ、OS 設定に追従するライト／ダークテーマ。UI 部品には Mantine を使うが、既定の見た目をそのまま採用せず、7.2 のデザイン方針に沿ってテーマを定義する。

| パス | ロール | 内容 |
| --- | --- | --- |
| `/login` | 未ログイン | パスワード入力欄1つとログインボタン |
| `/` | 全 | ダッシュボード。次の練習を最上位に置き、本番情報・出欠・備考・資料・問い合わせへ続ける |
| `/practices` | 全 | 練習日程一覧。「今後」「過去」を切り替え。各練習に会場・詳細・録音・地図・カレンダー導線 |
| `/pieces` | 全 | 曲一覧とボウイングリンク |
| `/admin` | admin | 管理トップ。各管理画面への導線 |
| `/admin/concerts` | admin | 演奏会の作成・編集・アーカイブ・削除、資料リンクの管理 |
| `/admin/venues` | admin | 会場マスタの作成・編集・削除 |
| `/admin/practices` | admin | 練習の作成・編集・複製・削除、録音リンクの追加・並べ替え・削除 |
| `/admin/pieces` | admin | 曲の作成・編集・並べ替え・削除、ボウイングURLの設定 |
| `/admin/settings` | admin | 管理者メールアドレスの設定、両ロールのパスワード変更 |

一覧は行数が少ない想定なのでページングを設けない。練習の詳細は一覧内で展開して見せ、個別ページを作らない。

### 7.1 演奏会の切り替え

ヘッダに演奏会セレクタを置く。選択中の演奏会は URL のクエリパラメータ `?concert=<id>` を正とし、指定がない場合は次の順で解決する。

1. Cookie `oem_concert` に前回の選択があり、その演奏会が存在すればそれ
2. `status = 'active'` のうち `performance_date` が最も近い将来のもの
3. それも無ければ最新に作られた演奏会

解決した結果は URL のクエリに書き戻す。以降の画面はクエリを見るだけでよい（[ADR-0009](./adr/0009-canonicalize-selected-concert-in-url.md)）。

セレクタは進行中とアーカイブ済みを区別して表示する。演奏会が1件も無い場合、閲覧側は「まだ公開された演奏会がありません」と表示し、管理者には演奏会作成への導線を出す。

### 7.2 デザイン方針

ダッシュボードは「出発案内型」の実用アプリを基準にする。**次の練習**を第一画面の主役とし、大きな日付・時刻・会場・地図・カレンダーをまとめて置く。その直後に本番情報と出欠回答を配置し、備考・資料・問い合わせは続ける。主要画面への移動は下部固定ナビ（ホーム / 練習日程 / 曲・ボウイング。管理者は管理を追加）とし、演奏会セレクタはヘッダに常時置く（[ADR-0015](./adr/0015-adopt-mantine-with-purpose-built-theme.md)、[ADR-0017](./adr/0017-departure-board-dashboard-layout.md)）。

管理画面も同じ色・タイポ・部品を使い、装飾より入力と確認のしやすさを優先する。

画一的な AI 生成 UI に見えやすいパターンを避けるため、次をデザイン上の制約とする。

- 紫・青を中心としたグラデーション、ガラス表現、装飾だけの影を使わない
- すべてを同じ角丸カードに入れず、日程や資料はリストと区切り線を基本にする
- 角丸は原則6〜8px。ピル型は状態や選択肢を表す場合だけに限る
- アイコンは地図・外部リンク・下部ナビなど意味が明確な場合だけ使い、アイコンだけの操作を避ける
- 本文は16px相当、行高1.5以上、操作領域は44px以上を基準にする
- 色は温かいアイボリー、墨色、深いボルドーを基本とし、ダークテーマでもコントラストを保つ
- 見出しに限って明朝を足してよい。本文は読みやすいゴシックを使う
- アニメーションは状態変化を伝える用途に限り、装飾的なフェードインを付けない

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
- 期限切れセッションはログイン成功時にまとめて削除する（9.5）

### 8.4 認可の強制

SPAモードのため画面側のガードは強制力を持たない。したがって次の二層で守る。

1. **サーバ関数の middleware**（実体）: `requireAuth`（セッション必須）と `requireAdmin`（さらに `role = 'admin'` 必須）を用意し、**すべてのサーバ関数がどちらかを必ず通る**ようにする。読み取り系も例外にしない
2. **ルートの `beforeLoad`**（体験）: 未ログインならログイン画面へ、`extra` が管理画面を開いたらダッシュボードへ、クライアント側で誘導する。判定に使うセッション照会はクライアントで1回だけ行い、以降は使い回す（[ADR-0005](./adr/0005-cache-session-lookup-on-client.md)）

### 8.5 その他の防御

- **ログインのレート制限**: 同一 IP（`CF-Connecting-IP`）で直近5分の失敗が10回に達したら、以後の試行を一定時間拒否する。`login_attempts` の古い行はログイン成功時に掃除する（9.5）
- **CSRF**: Cookie が `SameSite=Lax` なので他サイトからの POST では送信されない。加えて `Sec-Fetch-Site`（無ければ `Origin`）が自サイトと一致しないサーバ関数呼び出しを 403 で落とす。更新系に限らず全サーバ関数に掛ける（[ADR-0006](./adr/0006-apply-csrf-middleware-to-all-server-functions.md)）
- **秘密情報の扱い**: 環境変数は `cloudflare:workers` の binding からリクエストごとに読む（モジュール読み込み時に読むとクライアントバンドルへ混入する恐れがあるため）
- **レスポンスヘッダ**: `X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、外部リンクは `rel="noopener noreferrer"`。ヘッダは Worker が返す分を `src/start.ts` で、assets binding が Worker を通さず返す静的ファイル分を `public/_headers` で付ける

### 8.6 パスワードの変更

`/admin/settings` から両ロールのパスワードを変更する。どちらのロールを変える場合も、管理者の現在のパスワードを入力させて照合する（[ADR-0013](./adr/0013-require-admin-password-to-change-passwords.md)）。新しいパスワードは12文字以上で、確認用の再入力と一致することを求める。

変更したロールのセッションは 8.3 のとおり全件失効させる。管理者のパスワードを変えたときは操作中のセッションも落ちるため、画面にログインし直す導線を出す。

## 9. 問い合わせと外部サービスへの導線

### 9.1 管理者への問い合わせ

`app_settings.admin_email` が設定されているときだけ、閲覧画面に「管理者へ問い合わせる」を表示する。リンクは `mailto:` とし、アプリからメールを送信しない。件名は `【<演奏会名>】エキストラからの問い合わせ` とする。本文は `演奏会名：<演奏会名>`、`氏名：`、`問い合わせ内容：` を改行で並べ、件名と本文を URL のクエリ値としてエンコードする。

管理者メールアドレスは団体共通の問い合わせ先として1件だけ保持する。管理者本人のアドレスを格納することは「個人情報を保持しない」原則の例外として明記し、エキストラのメールアドレス、入力内容、送信履歴は保存しない。

### 9.2 地図

会場の住所があるとき、`https://www.google.com/maps/search/?api=1&query=<URLエンコードした住所>` を外部リンクとして開く。本番会場はダッシュボード、練習会場は次の練習と練習日程一覧から開ける。Google Maps API や API キーは使わない。

### 9.3 Google カレンダー

本番日または練習日があるとき、`https://calendar.google.com/calendar/render?action=TEMPLATE` を基準に Google カレンダーの予定作成 URL を組み立てて外部リンクとして開く。本番のタイトルは演奏会名、練習は `<演奏会名> 練習` とし、会場名と住所を場所に設定する（[ADR-0016](./adr/0016-build-calendar-links-with-local-date-strings.md)）。

本番は終日の予定とし、終了日には翌日を指定する。練習は開始・終了時刻が両方ある場合だけ時刻入りの予定とし、`ctz=Asia/Tokyo` を付ける。どちらかが欠ける場合は終日予定とする。日時は設計書5.4の日本時間文字列から直接組み立て、`Date` によるタイムゾーン変換や末尾の `Z` は使わない。

### 9.4 練習の複製

管理画面の「複製して編集」は、ページ上部の新規作成フォームに元の練習の開始時刻・終了時刻・会場・詳細を設定し、日付を空にして表示する。フォームへスクロールして日付欄にフォーカスする。保存するまでレコードは作らない。録音・録画リンクは過去の練習固有の情報なので複製しない。

### 9.5 認証データの掃除

リンクチェック用 Cron を採用しないため、期限切れセッションと7日より古い `login_attempts` の削除はログイン成功時に行う。ログイン時刻のちょうど7日前は残し、それより古い行を削除する。新しいセッションを発行した後、削除の2クエリを同じトランザクションのバッチで実行する。利用頻度が低いため専用の定期実行基盤は持たない。

## 10. 環境変数・シークレット

| 名前 | 種別 | 用途 |
| --- | --- | --- |
| `PASSWORD_PEPPER` | secret | パスワードハッシュ用の pepper |
| `ADMIN_INITIAL_PASSWORD` | secret | 初期投入用。投入後は削除してよい |
| `EXTRA_INITIAL_PASSWORD` | secret | 同上 |
| `DB` | D1 binding | データベース |

secret は `wrangler secret put` で設定する。ローカル開発では `.dev.vars`（gitignore 対象）に置く。`PASSWORD_PEPPER` を変えると既存パスワードが検証できなくなるため、変更時はパスワードの再設定が必要である。

## 11. テスト方針

**Vitest（単体）** — サーバ側のロジックを対象にする。

- パスワードのハッシュ生成・検証（正しい／誤ったパスワード、定数時間比較、形式の後方互換）
- セッションの発行・検証・期限切れ・失効
- ログインのレート制限判定
- 練習一覧の今後・過去の切り分けと並び順（日本時間の日付境界）
- 演奏会の選択解決順序
- 演奏会資料の5件上限と並べ替え
- `mailto:`、Google Maps、Google カレンダーのURL組み立て
- 練習複製時に引き継ぐ項目と引き継がない項目
- 入力検証（URL スキーム、メール形式、文字数上限）

**Playwright（E2E）** — 主要導線を3本に絞る。

1. エキストラのパスワードでログインし、演奏会情報・練習日程・資料・問い合わせ導線・曲とボウイングが見えることを確認する
2. 管理者のパスワードでログインし、会場・演奏会・資料・練習を作成し、練習を複製して、閲覧側に反映されることを確認する
3. パスワード変更（8.6）を確認する。現在のパスワードが違えば変わらないこと、変えたロールの開いているセッションが落ちること

E2E はローカルの D1（wrangler のローカルモード）に対して実行する。パスワードは `E2E_ADMIN_PASSWORD` / `E2E_EXTRA_PASSWORD` で渡し、未設定のテストは飛ばす。

3のうちパスワードを実際に書き換えるものは `E2E_PASSWORD_CHANGE=1` を付けたときだけ動かす。`E2E_BASE_URL` で本番を向いている場合は動かさない。ロールごとにパスワードは1本しかないため、この検証を含めるときは直列に実行する。

## 12. CI/CD と環境

- 環境は本番のみ。プレビュー環境は必要になってから検討する
- GitHub Actions: PR で Lint・型チェック・Vitest を実行する。E2E が整備できた段階で Playwright も PR の検査に加える
- main ブランチへのマージで `wrangler d1 migrations apply`（本番）→ `wrangler deploy` を実行する
- デプロイに使う Cloudflare API トークンは GitHub Secrets に置く
- マイグレーションは前方互換を保つ（列の削除やリネームは、追加→移行→削除の順に分ける）。バックアップは D1 の `wrangler d1 export` を必要時に手動で取る

## 13. 将来の拡張候補

いま作らないが、将来必要になった場合の候補。

- ボウイング・録音リンクの自動チェックと管理者への通知（既存の `link_checks` テーブルを再利用できる）
- 1曲に複数のボウイングリンク（パート別）を持たせる（`pieces.bowing_url` を別テーブルに切り出す）
- アプリからのメール送信や通知（現状の問い合わせは `mailto:` のみ）
- パスワードハッシュのより強い方式への移行（形式にバージョン識別子があるため段階移行できる）

## 14. 決定記録

決定の一覧。実装中に行った判断は `docs/adr/` に ADR として1件1ファイルで記録し、ここには索引の1行だけを置く。書き方と運用は [ADR-0000](./adr/0000-use-markdown-architectural-decision-records.md) が正。

| 決定 | 理由 | 詳細 |
| --- | --- | --- |
| Cloudflare Workers + D1 に一本化 | 無料枠に収まり、cron が標準機能で、構成要素が最少になる | — |
| SPAモード（SSRしない） | 全ページ認証必須で SEO 不要。無料プランの CPU 10ms 制限に対して SSR が最大のリスク要因 | — |
| 認証は共有パスワード2本 | 個人情報を持たない方針。個人単位の識別が要件に無い | — |
| ハッシュは HMAC-SHA256 + pepper | CPU 10ms 制限下で反復型の鍵導出関数が使えない。DB 単体の漏洩では総当たりできない構成にする | — |
| 出欠リンクは演奏会に1つ | 外部サービスで全日程をまとめて回答する運用に合わせる | — |
| ボウイングは1曲1リンク | 現状の共有方法に合わせ、パート別は将来の拡張とする | — |
| 会場はマスタ化 | 同じ会場を繰り返し使うため、入力の手間と表記揺れを減らす | — |
| 練習の個別ページを作らない | 件数が少なく、一覧内の展開で足りる | — |
| 実装中の判断は ADR に記録する | 代替案と、その決定で犠牲にしたものが PR の説明に埋もれるのを防ぐ | [ADR-0000](./adr/0000-use-markdown-architectural-decision-records.md) |
| CI は PR だけで動かし、main への push は Deploy が検査も兼ねる | 検査を通っていないコードが本番に出ないことを、ワークフローをまたがずに保証する | [ADR-0001](./adr/0001-split-ci-and-deploy-workflows.md) |
| TypeScript 7（ネイティブ実装）を採用 | 型チェックが速い。新規プロジェクトなので 5.x への差し戻しが容易 | [ADR-0002](./adr/0002-adopt-typescript-7.md) |
| Worker のエントリで Start の `fetch` をラップする | Workers の `env` が Start のオプション引数として渡るのを防ぐ | [ADR-0003](./adr/0003-wrap-start-fetch-in-worker-entry.md) |
| 列挙値は CHECK 制約ではなくアプリ層で担保する | 13章の `target_type` 追加を、テーブル再作成なしで行えるようにする | [ADR-0004](./adr/0004-enforce-enums-in-app-layer.md) |
| ルートガード用のセッション照会はクライアントで1回だけ行う | 画面遷移のたびに D1 クエリを足さない。認可の実体はサーバ関数側にある | [ADR-0005](./adr/0005-cache-session-lookup-on-client.md) |
| CSRF 対策は更新系に限らず全サーバ関数に掛ける | 「更新系だけ」を人手で維持すると付け忘れに気づけない | [ADR-0006](./adr/0006-apply-csrf-middleware-to-all-server-functions.md) |
| DB を伴うロジックの単体テストは `node:sqlite` で行う | 検証したいのは SQL の意味論。マイグレーションを流すのでスキーマとずれない | [ADR-0007](./adr/0007-test-db-logic-on-in-memory-sqlite.md) |
| SPA シェルは assets binding から返し、Worker はサーバ関数だけを受ける | document ごとに Worker が描画していた。5.2・5.3の前提が実態と食い違っていた | [ADR-0008](./adr/0008-serve-spa-shell-from-assets-binding.md) |
| 選択中の演奏会は URL のクエリを正とし、`beforeLoad` で書き戻す | `loaderDeps` が受け取れるのは search だけ。コンテキストに置くと切り替えが `loader` の再実行につながらない | [ADR-0009](./adr/0009-canonicalize-selected-concert-in-url.md) |
| 削除の確認はネイティブの `<dialog>` で行う | 連鎖して消えるものを対象ごとの文言で出せる。`window.confirm` では書式が揃わない | [ADR-0010](./adr/0010-confirm-deletions-with-native-dialog.md) |
| `sort_order` は 0 からの連番で保ち、並べ替えは2行だけ書き換える | 書き込み件数を一覧の長さに比例させない（5.3のサブリクエスト上限） | [ADR-0011](./adr/0011-keep-sort-order-dense.md) |
| ボウイングURLを差し替えたら前のURLの検知結果を捨てる | 直したリンクが翌日のチェックまで要確認として出続けるのを防ぐ | [ADR-0012](./adr/0012-drop-link-check-on-url-change.md) |
| パスワード変更には管理者の現在のパスワードを要求する | ログインしたままの端末を他人が触っても書き換えられないようにする | [ADR-0013](./adr/0013-require-admin-password-to-change-passwords.md) |
| リンク切れ検知を見送り、利用者の利便性を優先する | 数件のリンク監視より、問い合わせ・資料・地図・カレンダー・複製の方が日常的な効果が高い | [ADR-0014](./adr/0014-prioritize-portal-usability-over-link-checking.md) |
| Mantineを用途固有のテーマで使う | CRUD部品を再利用しつつ、画一的なSaaS風デザインを避ける | [ADR-0015](./adr/0015-adopt-mantine-with-purpose-built-theme.md) |
| Googleカレンダーの予定を日本時間文字列から直接組み立てる | 実行環境による日時のずれを避け、タイトルと会場を予定だけで確認できるようにする | [ADR-0016](./adr/0016-build-calendar-links-with-local-date-strings.md) |
| ダッシュボードは出発案内型で次の練習を最上位に置く | 開いてすぐ日時・会場・地図へ届く。本番と出欠も第一画面に残す | [ADR-0017](./adr/0017-departure-board-dashboard-layout.md) |
