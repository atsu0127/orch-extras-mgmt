# オンボーディング（コード構成の案内）

対話でコード構成を追いながら書いたメモ。設計の正は [platform/design.md](./platform/design.md) と各機能の `design.md`。

---

## 1. 全体地図

オーケストラのエキストラ向け情報ポータル。共有パスワード2本（admin / extra）。個人アカウントは持たない。演奏会が管理の最上位単位。

### 箱の役割

| 場所          | 役割          |
| ------------- | ------------- |
| `src/`        | アプリ本体    |
| `docs/`       | 設計・判断    |
| `migrations/` | DB 変更の SQL |
| `e2e/`        | Playwright    |
| `.github/`    | CI/CD         |

### `src/` の分け方

| 場所             | 役割                               |
| ---------------- | ---------------------------------- |
| `routes/`        | 画面（URL と対応）                 |
| `components/`    | UI 部品                            |
| `auth/`          | ログイン・セッション               |
| `db/`            | 接続とテーブル定義                 |
| `lib/`           | 画面にもサーバにも出す共通定数・型 |
| `concerts/` など | ドメイン（業務ロジック）           |
| `server.ts`      | Worker 入口                        |
| `start.ts`       | Start 全体の middleware            |
| `router.tsx`     | ルーター作成                       |

ドメインはだいたい `queries.ts`（読）/ `mutations.ts`（書）/ `input.ts`（入力の zod）に分かれる。

### データの骨格

```
演奏会
  ├── 練習 / 曲 / お知らせ / 資料リンク
会場（マスタ。演奏会に従属しない）
```

---

## 2. リクエストの流れ（SPA）

ページ表示は静的資産、データの読み書きだけ Worker。無料プランの CPU 制限（約 10ms）のため SSR しない。

```
ページを開く  →  Assets（index.html + JS）
データを取る  →  /_serverFn/* → Worker（server.ts）→ D1
```

振り分けは `wrangler.jsonc` の `assets.run_worker_first: ["/_serverFn/*"]`。
`/_serverFn` 自体は **TanStack Start の既定 base**（`serverFns.base` の default）。このリポジトリでは上書きしていない。wrangler 側はそれに合わせて Worker へ通しているだけ。

HTML/JS はログイン前後で同じ（ビルド時に認証しない）。サインイン判定は起動後の Server Function（Cookie）で行う。`beforeLoad` は未ログイン時の誘導用。データの実ガードは各 Server Function の middleware。同一オリジンのため典型的な CORS 問題は薄い。なりすまし対策は `start.ts` の CSRF。

---

## 3. Server Functions（ざっくり）

`createServerFn` で定義する、クライアントから呼べるサーバ側の処理。Next.js の Server Actions に近いが、次が違う。

|        | Server Actions（Next） | Server Functions（Start）                             |
| ------ | ---------------------- | ----------------------------------------------------- |
| 主用途 | 更新・フォーム寄り     | 読みも書きも同じ形（RPC）                             |
| HTTP   | 基本 POST              | GET / POST を選べる                                   |
| 定義   | `"use server"`         | `createServerFn().validator().middleware().handler()` |

このアプリでは一覧取得も更新も Server Functions。OpenAPI は置かない。

---

## 4. 型の共有

同じ TypeScript 上の関数署名が契約。

### Client → DB（下り）

```
form / 呼び出し
  → zod（inline または input.ts。form と共有可）
  → createServerFn.validator（型推論 + 実行時検証）
  → handler → queries/mutations
  → drizzle + schema.ts → D1
```

### DB → Client（上り）

```
D1 → schema.ts
  → queries.ts で PieceEntry など画面用の型に整形
  → createServerFn.handler の return 型が呼び出し側へ推論
  → Client
```

要点:

- 入力の正は **zod**
- DB 操作の内側は **schema.ts**
- 外に出す形は **queries の明示型**（生テーブルをそのまま出さない）
- 画面から `src/db/schema.ts` を直接 import しない（drizzle がクライアント束に載る）

---

## 5. TanStack Start（このプロジェクトでの使い方）

「React + サーバ処理」を一つの枠で書く。ここでは次だけで足りる。

| 部品            | ファイル         | 役割                      |
| --------------- | ---------------- | ------------------------- |
| 全体 middleware | `src/start.ts`   | CSRF など全サーバ関数共通 |
| Worker 入口     | `src/server.ts`  | fetch を Start に渡す     |
| ルーター        | `src/router.tsx` | 画面ツリー                |
| 画面            | `src/routes/**`  | URL ごとのページ          |

```
Workers → server.ts → Start
  ├─ start.ts の requestMiddleware
  └─ /_serverFn → createServerFn ／ 画面は Router（本番 HTML は Assets）
```

`createServerFn`: `.middleware` → `.validator(zod)` → `.handler`。クライアントからは通常の関数呼び出しに見え、実体は `/_serverFn`。

SPA のため認可の強制はサーバ関数側。`beforeLoad` の redirect は誘導用。

感覚の対応: ページ = Router（`routes/`）、データ = Server Functions。親レイアウトは親の `route.tsx` + `<Outlet />`。

---

## 6. 画面ルーティング（`src/routes/`）

TanStack Router のファイルベースルーティング。ファイルを置くと URL になる。`routeTree.gen.ts` は生成物（手編集しない）。

### 命名の約束

| ファイル | 意味 |
| --- | --- |
| `__root.tsx` | 最外枠（HTML・テーマ） |
| `login.tsx` | `/login` |
| `_authed/` | パスに出ないレイアウト群（要ログインの入れ物） |
| `_authed/index.tsx` | `/`（ダッシュボード） |
| `_authed/practices.tsx` | `/practices` |
| `_authed/admin/route.tsx` | `/admin` 配下のレイアウト（admin ロール誘導） |
| `_authed/admin/practices.tsx` | `/admin/practices` |
| `-*.test.ts(x)` | ルート走査から外すテスト（`-` 始まり） |

`_` 付きフォルダは **URL には出ないが、子を包むレイアウト**。

### ツリー

```
__root
├── /login
└── _authed（セッション確認・演奏会選択・共通ヘッダ）
    ├── / （index）
    ├── /practices, /pieces
    └── /admin（admin 以外は / へ）
        ├── concerts, practices, pieces, …
        └── settings
```

親が `<Outlet />` で子を描画する。選択中の演奏会はクエリ `?concert=`（画面遷移でも retain）。

---

## 7. サーバ関数の実体（queries / mutations）

### 役割分担

| 層 | 置き場 | やること |
| --- | --- | --- |
| 入口 | 多くは `routes/` や一部 `components/` の `createServerFn` | 認可・zod・handler の薄い配線 |
| 業務 | `src/<domain>/queries.ts` / `mutations.ts` | DB 読み書きの本体（テストしやすい純関数寄り） |
| 入力スキーマ | `input.ts` またはルート内の zod | フォームと共有しがち |

例外: 画面横断で使うもの（例: `auth/functions.ts`、`concerts/functions.ts` の `listConcerts`）はドメイン側に `createServerFn` を置く。

### 1本の典型（管理の練習追加）

```
画面 useServerFn(addPractice) / loader から呼び出し
  → createServerFn POST + requireAdmin + practiceInput
  → createPractice(getDb(), …)   ← mutations.ts
  → D1
```

読み取りは loader が GET の server fn を呼ぶことが多い。更新はコンポーネントが `useServerFn(...)` で呼ぶ。

### 作法（必須）

- すべての server fn に `requireAuth` または `requireAdmin`（読取も例外にしない）
- 入力は zod（`.validator`）
- `getDb()` / secret は handler 内で読む（モジュール先頭で読まない）
- CSRF は `start.ts` 一括（個別に足さない）

### `useServerFn`

コンポーネントから server fn を呼ぶときの薄いラッパー。RPC 自体は `createServerFn` が担い、`useServerFn` は主に次を行う。

- 渡した server fn を呼ぶ（中で `/_serverFn`）
- `requireAuth` などが投げる **redirect** を捕まえて Router の画面遷移にする（例: `/login`）
- `useCallback` で参照を安定させる

`loader` からは server fn を直接呼んでよい（Router が redirect を扱う）。ボタンやフォームなどコンポーネント内では `useServerFn(...)` 経由が安全。

---

## 8. 認証・認可（`src/auth/`）

個人アカウントなし。共有パスワード2本（`admin` / `extra`）。ロール定義は `src/lib/roles.ts`（画面にも出すため schema と分離）。

### ログインの流れ

```
パスワード入力 → login（server fn）
  → レート制限（同一 IP）
  → 両ロールのハッシュと照合（HMAC-SHA256 + PEPPER）
  → 一致したロールでセッション発行
  → Cookie `__Host-oem_session`（HttpOnly）に生トークン
  → DB にはトークンの SHA-256 のみ
```

パスワードは反復型 KDF を使わない（Workers CPU 10ms 制約）。pepper は Workers secret。

### 認可の二層

| 層 | 場所 | 役割 |
| --- | --- | --- |
| 誘導 | `_authed` / `_authed/admin` の `beforeLoad` | 未ログイン→login、非 admin→`/` |
| 強制 | `requireAuth` / `requireAdmin` | 全 server fn（読取含む） |

例外の入口: `login` と `getCurrentSession` 程度。

### 主なファイル

| ファイル | 内容 |
| --- | --- |
| `functions.ts` | login / logout / getCurrentSession |
| `middleware.ts` | requireAuth / requireAdmin |
| `session.ts` / `cookie.ts` | 発行・照合・Cookie |
| `password.ts` | ハッシュ検証 |
| `session-cache.ts` | クライアントでセッション照会を1回にまとめる（体験用。認可ではない） |
| `rate-limit.ts` / `cleanup.ts` | 試行制限、成功時の掃除（Cron なし） |

CSRF は `start.ts`（全 server fn）。セッション有効期限は30日。パスワード変更時はそのロールの全セッションを失効。

---

## 9. データベースとドメイン

### 技術

- DB: Cloudflare D1（SQLite）
- ORM: Drizzle（`src/db/schema.ts`）
- 接続: `getDb()`（handler 内で binding を読む）
- マイグレーション: `pnpm db:generate` → `migrations/` → `wrangler d1 migrations apply`

### テーブルの関係（業務）

```
venues（会場マスタ）
concerts ──┬── practices ──── practice_media（録音リンク）
           ├── pieces（楽譜 URL 最大2）
           ├── announcements
           └── concert_resources
app_settings（管理者メールなど1行）
```

認証系: `credentials` / `sessions` / `login_attempts`  
`link_checks` は残っているが現行機能では未使用。

削除の意味:

- 演奏会削除 → 配下は CASCADE
- 会場削除 → 練習等の会場は SET NULL（記録は残す）

### ドメインフォルダとの対応

| フォルダ | 主なテーブル |
| --- | --- |
| `concerts/` | concerts |
| `practices/` | practices, practice_media |
| `pieces/` | pieces |
| `venues/` | venues |
| `announcements/` | announcements |
| `concert-resources/` | concert_resources |
| `settings/` | app_settings, credentials（パスワード変更） |
| `auth/` | sessions, credentials, login_attempts |

### 時刻

- 練習の `date` / 時刻: 日本時間の文字列（TZ 変換しない）
- `created_at` 等: UTC の ISO 8601

### 制約メモ

1リクエストの D1 クエリもサブリクエストに数える（上限50）。一覧で N+1 を避ける。画面から `schema.ts` を直接 import しない。

---

## 10. UI 部品と共通ライブラリ

### UI（Mantine）

- `src/theme.ts` … クールニュートラル＋ボルドー、Noto Sans/Serif JP
- `src/styles.css` … アプリ固有のレイアウト調整
- ルートの殻で `MantineProvider`（`__root.tsx`）

### `src/components/`（画面横断の部品）

| 系統 | 例 | 用途 |
| --- | --- | --- |
| 管理フォーム | `admin-form`, `form-controls`, `venue-select-field` | 保存・検証エラー表示の型 |
| 一覧操作 | `admin-row-actions`, `control-row`, `confirm-button` | 編集・削除・並べ替え |
| 閲覧 | `practice-item`, `list-item`, `external-link` | エキストラ向け表示 |
| 状態表示 | `states` | 空・未選択演奏会・Pending/Error |
| 大きめ機能 UI | `bulk-practice-form`, `concert-resource-admin` | 特定機能の塊（中に server fn を持つこともある） |

画面固有の組み立ては `routes/` 側。使い回す塊だけ `components/`。

### `src/lib/`（クライアントにも載せてよい共通）

| ファイル | 内容 |
| --- | --- |
| `limits.ts` | 文字数・件数上限（zod と schema の共通出所） |
| `validation.ts` | 日付・URL など zod 部品とエラー文 |
| `roles.ts` | ロール定数・表示名 |
| `date.ts` | JST の「今日」や表示整形 |
| `ordering.ts` | 並べ替え方向など |
| `external-urls.ts` | Maps / カレンダー等の外部 URL 生成 |

**置き分けの理由**: 画面が `db/schema` を読むと drizzle がバンドルに載る。だから上限やロールは `lib/` に置き、schema やサーバがそれを読む。

---

## 11. クライアント状態（jotai 等は使わない）

jotai / Zustand / Redux / React Query は未使用。置き場を用途で分ける。

| 種類 | 置き場 | 例 |
| --- | --- | --- |
| 共有したいアプリ状態 | URL search + Route context | `?concert=`、`?view=`、session / 選択中演奏会 |
| サーバ由来のデータ | `loader` → `useLoaderData()` | 練習・曲などの一覧 |
| フォームの一時入力 | コンポーネントの `useState` | 入力欄、編集中フラグ |
| 取り直し抑制のみ | モジュール変数キャッシュ | `session-cache` / `concert-cache` |

演奏会の選択は URL が正（遷移でも retain）。保存後は loader を再実行して一覧を取り直す（クライアントに一覧の複製を持たない）。

`*-cache` は UI ストアではなく、同一タブでの server fn 二重呼び出しを減らすメモ。ログイン・ログアウトや演奏会 CRUD で `forget*` する。

---

## 12. 開発・テスト・デプロイ

### 日常コマンド

| コマンド | 用途 |
| --- | --- |
| `pnpm dev` | ローカル（Workers ランタイム） |
| `pnpm lint` / `typecheck` / `test` | 検査（コミット前の基本） |
| `pnpm db:migrate` / `db:seed` | ローカル D1 |
| `pnpm build` / `preview` | 本番相当の確認 |
| `pnpm test:e2e` | Playwright（要パスワード環境変数） |

秘密は `.dev.vars`（git 外）。`wrangler.jsonc` を変えたら `pnpm cf-typegen`。

### テストの分け方

| 種類 | 場所 | 要点 |
| --- | --- | --- |
| 単体 | `src/**/*.test.ts(x)`（Vitest / node） | Start プラグインなし。DB ロジックはメモリ SQLite も利用 |
| E2E | `e2e/`（Playwright・モバイル幅） | 未設定なら migrate + seed:reset。本番 URL も `E2E_BASE_URL` で可 |

### CI/CD

- PR: Lint・型・Vitest・Playwright（`.github/workflows/ci.yml`）
- `main` マージ: マイグレーション適用 → deploy（`deploy.yml`）
- `main` への直接 push はドキュメントのみ想定（本番デプロイが走る）

### 設計の読み方

| 知りたいこと | 場所 |
| --- | --- |
| 横断（認証・無料枠・CI） | `docs/platform/design.md` |
| 機能仕様・タスク | `docs/<feature>/` |
| 判断の経緯 | `docs/adr/` |
| 初期総合案（凍結） | `docs/archive/initial/` |

このファイル（ONBOARDING）はコード構成の入口。仕様の正は上記。
