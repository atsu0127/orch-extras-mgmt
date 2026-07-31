# Phase 8 セキュリティ点検（T8-1）

点検日: 2026-07-31  
対象: 設計書 6.3・8章・9.1、および実装時点の全サーバ関数

## 結論

重大な欠落は見つからなかった。認可・入力検証・外部URL組み立て・秘密情報の扱いは設計どおり。意図的な認可例外は認証入口の2関数のみで、コード上も `src/auth/middleware.ts` に明記されている。

## 1. サーバ関数の middleware

実体の `createServerFn` は 35 件。

| 認可 | 件数 | 内容 |
| --- | ---: | --- |
| `requireAdmin` | 28 | 管理画面の読み取り・更新すべて |
| `requireAuth` | 5 | `logout`、`listConcerts`、ダッシュボード／練習／曲の閲覧 |
| なし（意図的例外） | 2 | `login`、`getCurrentSession` |

### 意図的例外

| 関数 | 理由 |
| --- | --- |
| `login` | 未ログインで呼ぶ入口。レート制限とパスワード照合をハンドラ内で行う |
| `getCurrentSession` | 画面誘導用のセッション有無照会（設計書 8.4 の体験層）。秘密は返さず `role` または `null` のみ |

上記以外に middleware 未設定のサーバ関数は無い。

### CSRF とセキュリティヘッダ

- `src/start.ts` の `requestMiddleware` に CSRF（`createCsrfMiddleware`、serverFn 対象）と `X-Content-Type-Options` / `Referrer-Policy` を明示配置（[ADR-0006](./adr/0006-apply-csrf-middleware-to-all-server-functions.md)）
- 静的資産は `public/_headers` で同ヘッダを付与（assets binding は Worker を通らない）

## 2. URL・メール検証

共通部品は `src/lib/validation.ts`。

| 検証 | 挙動 |
| --- | --- |
| `requiredUrl` / `optionalUrl` | `http:` / `https:` のみ許可。`javascript:` や相対 URL は拒否。上限は `MAX_LENGTH.url` |
| `optionalEmail` | 空は `null`。非空はメール形式と `MAX_LENGTH.adminEmail`（254） |
| 日付・時刻 | 実在日付と `HH:MM` |

更新系サーバ関数はいずれも `.validator(...)` で zod スキーマを通す。URL を受け取る入力（出欠・資料・録音・ボウイング）は上記 URL スキーマを使う。管理者メールは `submitAdminEmail` が `optionalEmail` を使う。

単体テスト: `src/lib/validation.test.ts`

## 3. `mailto:` のエンコード

`src/lib/external-urls.ts` の `buildInquiryMailtoUrl`:

- 件名・本文を `encodeURIComponent` でクエリ化（`+` ではなく `%20` / `%0D%0A`）
- 演奏会名に含まれる CR/LF は空白へ置換し、件名・本文への改行挿入を防ぐ
- 宛先メールは設定保存時に検証済みの値をそのまま `mailto:` の path に載せる（未検証の自由入力は載せない）

単体テスト: `src/lib/external-urls.test.ts`

表示条件: `app_settings.admin_email` が設定されているときだけダッシュボードに問い合わせ導線を出す（設計書 9.1）。

## 4. 秘密情報の混入

| 項目 | 結果 |
| --- | --- |
| `PASSWORD_PEPPER` | `env` からハンドラ／関数内で読む。モジュールトップレベルでの値の確定はしていない |
| `cloudflare:workers` | サーバ専用モジュール（`src/auth/*`、`src/db/client.ts`）のみ。画面コンポーネントから直接 import していない |
| セッション Cookie | `__Host-oem_session`、`HttpOnly` / `Secure` / `SameSite=Lax` |
| 資格情報 API | `listCredentials` は `role` と `updatedAt` のみ。ハッシュは返さない |
| 初期パスワード secret | シード用。本番投入後は削除してよい（設計書 10章） |

## 5. 外部リンク

閲覧・管理の外部遷移は原則 `ExternalLink`（`rel="noopener noreferrer"`）。曲一覧のボウイング行はパネル行の見た目のため素の `<a>` だが、同等の `rel` を付けている。URL 本体は保存時に http(s) 検証済み。

## 6. その他（設計どおりの防御）

- ログイン失敗の IP レート制限（設計書 8.5）
- パスワード変更時は管理者の現在パスワードを要求し、変更ロールのセッションを全件失効（8.6 / ADR-0013）
- 期限切れセッションと古い `login_attempts` はログイン成功時に掃除（9.5）

## 残課題・運用上の注意

- 本番の管理者メールと実データは、リリース後に管理画面から投入する運用とする（T8-3）。コード上の欠陥ではない
- `src/start.ts` の `requestMiddleware` から CSRF を外すと警告なく防御が消える。変更時は注意（ADR-0006）
