# orch-extras-mgmt

オーケストラのエキストラ（客演奏者）向け情報ポータル。練習日程、出欠の回答先、演奏会資料、地図、カレンダー、ボウイング、練習の録音を1か所にまとめて公開し、管理者がブラウザから更新できるようにする。

現在の状態: **初回リリース（Phase 0〜9）完了、Phase 10 設計済み**。本番で受け入れ確認済み。次期改善では演奏会ごとのお知らせを追加する。

本番: <https://orch-extras-mgmt.atsu-dq9.workers.dev>

## ドキュメント

- [設計書](docs/design.md) — 機能仕様、データモデル、認証設計、外部サービス導線の仕様。決定の一覧は14章
- [タスク一覧](docs/tasks.md) — 次期改善の作業、依存、受け入れ条件。初回リリース分は[アーカイブ](docs/archive/tasks-initial-release.md)
- [ADR](docs/adr/) — 実装中に行った設計判断の記録（[MADR](https://adr.github.io/madr/) の minimal 版）
- [セキュリティ点検（T8-1）](docs/security-review-t8.md) — サーバ関数の認可・入力検証・秘密情報の点検記録
- [受け入れ確認ガイド（T8-4）](docs/acceptance-guide.md) — 本番でのチェック手順

## 機能の概要

- 練習日程の一覧（日付・時刻・会場・フリーテキストの詳細）
- 出欠回答先（外部サービス）へのリンク
- 練習ごとの録音・録画リンク
- 曲ごとのボウイングリンク
- 演奏会の備考と最大5件の資料リンク
- 管理者への `mailto:` 問い合わせ
- 本番・練習会場の Google Maps と Google カレンダー導線
- 練習の複製入力
- 演奏会単位の管理と切り替え
- 管理者は更新可、エキストラは参照のみ。個人情報は保持せず、ロールごとの共有パスワードで認証する

## 技術構成

TanStack Start (React + TypeScript) を SPA モードでビルドし、Cloudflare Workers 1つとしてデプロイする。データは Cloudflare D1 (SQLite) に置き、定期実行基盤は持たない。いずれも無料プランの範囲内で運用する。UI は Mantine を用途固有のテーマ（クールニュートラル・ボルドー、Noto Sans JP / 見出しは Noto Serif JP）で使う。アイコンは `@tabler/icons-react`（外部リンク・並べ替えなど）。

画面は事前生成した SPA シェル（`dist/client/index.html`）を Cloudflare の assets binding が返し、Worker が受けるのは `/_serverFn/*` だけ。この振り分けは `wrangler.jsonc` の `assets` にある。**外すと document ごとに Worker が描画してしまい、無料プランの CPU 制限に効いてくる**（[ADR-0008](docs/adr/0008-serve-spa-shell-from-assets-binding.md)）。

詳細と選定理由は[設計書](docs/design.md)の5章および14章を参照。

## 開発の始め方

Node と pnpm のバージョンは [mise](https://mise.jdx.dev/) で固定している。

```bash
mise install                # mise.toml のとおりに Node と pnpm を用意する
pnpm install
cp .dev.vars.example .dev.vars   # ローカル用の secret（git 管理外）
pnpm db:migrate             # ローカル D1 にテーブルを作る
pnpm db:seed                # 両ロールのパスワードと確認用データを入れる
pnpm dev                    # http://localhost:3000
```

E2E テストを動かす場合は、初回だけブラウザを取得する。

```bash
pnpm exec playwright install chromium
```

## よく使うコマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | 開発サーバを起動する（Workers ランタイム上で動く） |
| `pnpm build` | 本番ビルド。`dist/client`（SPA シェルと静的資産）と `dist/server`（Worker）を出力する |
| `pnpm preview` | ビルド結果を Workers ランタイムで確認する |
| `pnpm lint` | Biome による Lint と書式チェック |
| `pnpm lint:fix` | Lint と書式の自動修正 |
| `pnpm typecheck` | TypeScript の型チェック |
| `pnpm test` | Vitest による単体テスト |
| `pnpm test:e2e` | Playwright による E2E テスト |
| `pnpm db:generate` | スキーマの変更からマイグレーション SQL を生成する |
| `pnpm db:migrate` | ローカル D1 にマイグレーションを適用する |
| `pnpm db:seed` | ローカル D1 に初期データを投入する（何度でも実行できる） |
| `pnpm db:seed:reset` | ローカル D1 を空にしてから固定の確認用データを入れ直す（E2E 用） |
| `pnpm cf-typegen` | `wrangler.jsonc` から binding の型を再生成する |
| `pnpm deploy` | ビルドして本番へデプロイする |

`wrangler.jsonc` を変更したら `pnpm cf-typegen` を実行して `worker-configuration.d.ts` を更新する。

E2E 起動時（`E2E_BASE_URL` 未設定）は `globalSetup` が `pnpm db:migrate` と `pnpm db:seed:reset` を走らせ、毎回同じ初期状態にする。ログインを伴うものは、パスワードを環境変数で渡したときだけ動く。渡さなければその分は飛ばされる。

```bash
E2E_ADMIN_PASSWORD=<.dev.vars の値> E2E_EXTRA_PASSWORD=<.dev.vars の値> pnpm test:e2e
```

パスワードを実際に書き換える検証（変更後に旧パスワードで入れないこと、開いているセッションが落ちること）は、さらに `E2E_PASSWORD_CHANGE=1` を付けたときだけ動く。ロールごとにパスワードは1本しかないので、このときは全テストが直列で走る。CI では付けない。テストは最後に元のパスワードへ戻すが、途中で落ちた場合は `pnpm db:seed:reset` で戻す。

```bash
E2E_ADMIN_PASSWORD=... E2E_EXTRA_PASSWORD=... E2E_PASSWORD_CHANGE=1 pnpm test:e2e
```

デプロイ先を E2E で確認したい場合は接続先を指定する。

```bash
E2E_BASE_URL=https://orch-extras-mgmt.atsu-dq9.workers.dev pnpm test:e2e
```

## データベース

Cloudflare D1 を binding 名 `DB` で使う。テーブル定義は[設計書](docs/design.md)の6章が正。

- スキーマは `src/db/schema.ts`（Drizzle ORM）
- `pnpm db:generate` が `migrations/` に SQL を生成し、適用は `wrangler d1 migrations apply` が行う
- サーバ関数からは `src/db/client.ts` の `getDb()` を使う。binding は呼び出しごとに読む

本番への適用は main へのマージ時に CD が行う。手元から流す場合は影響が及ぶので事前に確認を取ること。

```bash
pnpm db:migrate                                                # ローカル
pnpm exec wrangler d1 migrations apply DB --remote             # 本番
pnpm exec wrangler d1 execute DB --local --command "SELECT 1"  # 中身を見る
```

### 初期データ

`pnpm db:seed` が `.dev.vars` の値から両ロールのパスワードを投入する。何度実行してもよく、2回目以降はパスワードだけを更新する。確認用の演奏会・練習・曲は、データベースが空のときだけ入る。E2E 用に毎回同じ状態へ戻すときは `pnpm db:seed:reset` を使う（ローカル専用）。

`pnpm db:seed:reset` と `--remote` の併用は拒否される。本番 D1 を空にして入れ直す用途には使わない。

## 運用（リリース後）

本番のパスワードと `PASSWORD_PEPPER` は投入済み（A-5）。**演奏会の実データと問い合わせ先メールは、デプロイ後に管理画面から入れる**想定である。

### 管理者メール（問い合わせ先）

1. 管理者でログインする
2. `/admin/settings` を開く
3. 問い合わせ用のメールアドレスを保存する

設定されているときだけ、閲覧画面に「管理者へ問い合わせる」（`mailto:`）が出る。アプリからメールは送らない。

### 実データの入れ方

管理画面で次の順に登録する。既存の確認用サンプルが残っている場合は、不要な演奏会・会場を削除してから入れ直す。

1. **会場** — 練習・本番で使う場所
2. **演奏会** — 名前・状態・本番日・本番会場・出欠URL・備考
3. **演奏会資料** — 最大5件。並べ替えて表示順を決める
4. **練習** — 日付・時刻・会場・詳細。終わった練習には録音リンクを付ける
5. **曲** — タイトル・作曲者・ボウイングURL。演奏順に並べる

練習の繰り返し入力は「複製して編集」で日付以外を引き継げる（録音は引き継がない）。

### パスワードの変更

`/admin/settings` から両ロールのパスワードを変えられる。変更には管理者の現在のパスワードが必要。変えたロールのセッションはすべて切れる。

### 本番 D1 への直接操作

手元から `wrangler d1 ... --remote` を流すと本番データに影響する。必要なときだけ、事前に確認してから実行する。通常の更新は管理画面で足りる。

## 画面

スマートフォン優先のカードUI。テーマは OS 設定に追従する。画面とロールの対応は[設計書](docs/design.md)の7章が正。

- `src/routes/_authed/` — ログイン必須の画面。`route.tsx` がヘッダ（演奏会セレクタとナビゲーション）と `main` を持つ
- `src/routes/_authed/admin/` — 管理画面。`route.tsx` が管理内サブナビを持ち、`/` は演奏会へ誘導する。画面ごとにサーバ関数と入力欄を1ファイルにまとめている
- `src/components/` — 空状態・読み込み中・エラー・外部リンク・練習1件の表示。読み込み中とエラーは `src/router.tsx` で既定に設定してあるので、画面ごとに書かなくてよい
- `src/concerts/` `src/practices/` `src/pieces/` `src/venues/` — 画面が使うデータ。`queries.ts` が読み取り、`mutations.ts` が更新、どちらも DB を受け取る素の関数。`functions.ts` がそれを包むサーバ関数という分け方にしている。単体テストは `queries.ts` / `mutations.ts` 側に書く
- `src/lib/` — 画面とサーバの両方が使う小物（文字数上限、ロール、日付、入力検証、並べ替え）

**画面から `src/db/schema.ts` を import しないこと**。スキーマを読むと drizzle がクライアントのバンドルに載る。画面にも出てくる定数は `src/lib/limits.ts` や `src/lib/roles.ts` のように `src/lib/` に置き、スキーマ側がそれを読む向きにしている。

### 管理画面のフォーム

- `src/components/admin-form.tsx` — 入力欄（`Field`）、外枠（`AdminForm`）、検証と保存と再読み込みをまとめた `useAdminForm` / `useAdminAction`。検証は画面とサーバ関数で同じ zod スキーマを使う
- `src/components/confirm-button.tsx` — 削除の確認。ネイティブの `<dialog>` を使う（[ADR-0010](docs/adr/0010-confirm-deletions-with-native-dialog.md)）。連鎖して消えるものを文言で伝える
- 並び順を持つもの（録音リンク、曲）は `sort_order` を 0 からの連番で保ち、上下の入れ替えで2行だけ書き換える（[ADR-0011](docs/adr/0011-keep-sort-order-dense.md)）。計算は `src/lib/ordering.ts`

選択中の演奏会は URL のクエリ `?concert=<id>` が正。指定が無ければ Cookie `oem_concert` → 進行中の直近 → 最新作成の順で解決し、結果をクエリに書き戻す（[ADR-0009](docs/adr/0009-canonicalize-selected-concert-in-url.md)）。

**管理画面で演奏会を作成・編集・削除したら `forgetConcerts()` を呼ぶこと**。演奏会一覧はクライアントに1回だけ取得して保持しているため、呼ばないとセレクタが古いままになる。

## 認証

ロールごとの共有パスワード2本で入る。仕様は[設計書](docs/design.md)の8章が正。

- `src/auth/` — パスワードのハッシュ、セッション、Cookie、認可 middleware、レート制限、パスワードの変更（`credentials.ts`）
- `src/routes/_authed/` — ログイン必須の画面。`_authed/admin/` はさらに管理者のみ
- `src/start.ts` — 全サーバ関数への CSRF 対策と、Worker が返すレスポンスへのセキュリティヘッダ
- `public/_headers` — 静的ファイルへのセキュリティヘッダ（assets binding は Worker を通らない）

**新しくサーバ関数を書くときは必ず `requireAuth` か `requireAdmin` を通すこと**。SPA モードなので
画面側のガードには強制力がない。CSRF 対策は `src/start.ts` で全体に掛かっているので個別の対応は要らない。

パスワードは `/admin/settings` から変更する。どちらのロールを変えるときも管理者の現在のパスワードを要求し（[ADR-0013](docs/adr/0013-require-admin-password-to-change-passwords.md)）、変更したロールのセッションは全件失効させる。管理者を変えると操作中のセッションも落ちるので、ログインし直すことになる。

## 環境変数

ローカルでは `.dev.vars`（git 管理外）、本番では `wrangler secret put` で設定する。必要な項目は `.dev.vars.example` と[設計書](docs/design.md)の10章を参照。`PASSWORD_PEPPER` を変えると既存のパスワードが検証できなくなるため、変更したら `pnpm db:seed` で入れ直す。

## CI/CD

- **CI**（`.github/workflows/ci.yml`）: PR で Lint・型チェック・単体テスト・Playwright（主要導線。パスワード変更 E2E は除く）を実行する
- **CD**（`.github/workflows/deploy.yml`）: main へのマージで、検査 → ビルド → 本番 D1 へのマイグレーション適用 → デプロイを実行する

CD には GitHub Secrets に `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` の登録が必要。
