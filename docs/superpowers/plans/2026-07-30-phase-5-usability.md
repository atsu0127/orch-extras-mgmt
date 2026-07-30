# Phase 5 利便性向上 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** T5-1〜T5-9を実装し、演奏会資料・問い合わせ・地図・カレンダー・練習複製・認証データ掃除を利用できるようにする。

**Architecture:** 既存のドメイン別アクセス層とルート内サーバ関数を拡張し、設定、演奏会資料、外部URL、練習複製、認証掃除を独立した小さなモジュールに分ける。DB関連は定数本のクエリで取得し、外部URLと複製データ抽出は副作用のない関数として単体テストする。

**Tech Stack:** TanStack Start、React 19、TypeScript 7 strict、Drizzle ORM 0.45、Cloudflare D1、zod 4、Vitest 4、Biome、Playwright

## Global Constraints

- 実装の正は `docs/design.md` と `docs/superpowers/specs/2026-07-30-phase-5-usability-design.md`
- 1リクエスト50サブリクエスト以内、CPU時間10ms以内
- 画面コンポーネントから `src/db/schema.ts` を import しない
- 日付・時刻は日本時間文字列のまま扱い、カレンダーURL生成で `Date` による変換をしない
- すべてのサーバ関数に `requireAuth` または `requireAdmin` を付け、入力を zod で検証する
- URLは `http://` / `https://` のみ、文字数上限は `src/lib/limits.ts` を唯一の出所にする
- `src/routeTree.gen.ts` と `worker-configuration.d.ts` は手で編集しない
- 各T5タスクのコミット前に `pnpm lint`、`pnpm typecheck`、`pnpm test` を通す
- コミットメッセージは日本語とし、本文に判断理由を書く

---

## File Structure

### 新規ファイル

- `src/settings/queries.ts`: `app_settings` の読み取り
- `src/settings/mutations.ts`: 固定ID `1` の設定 upsert
- `src/settings/mutations.test.ts`: 設定行の初回保存・変更・解除
- `src/concert-resources/queries.ts`: 演奏会資料の一覧取得とグルーピング
- `src/concert-resources/mutations.ts`: 資料の作成・編集・並べ替え・削除
- `src/concert-resources/mutations.test.ts`: 資料CRUD・5件上限・並べ替え
- `src/concerts/input.ts`: 演奏会フォームとサーバ関数で共有するzod入力
- `src/concerts/input.test.ts`: 備考を含む演奏会入力の検証
- `src/lib/external-urls.ts`: `mailto:`、Maps、Calendar URL生成
- `src/lib/external-urls.test.ts`: 外部URLの単体テスト
- `src/practices/duplicate.ts`: 練習を新規フォーム値へ変換
- `src/practices/duplicate.test.ts`: 引継ぎ項目の単体テスト
- `src/auth/cleanup.ts`: 認証データ削除クエリとD1バッチ
- `src/auth/cleanup.test.ts`: 削除対象と7日境界の単体テスト
- `migrations/0001_phase_5_usability.sql`: Phase 5の前方互換マイグレーション
- `migrations/meta/0001_snapshot.json`: drizzle-kit生成スナップショット

### 主な変更ファイル

- `src/db/schema.ts`: `concerts.note`、`concertResources`、`appSettings`
- `src/lib/limits.ts`: 備考・資料・メールの上限
- `src/lib/validation.ts`: `optionalEmail`
- `src/concerts/queries.ts`: 備考・資料件数を含む型と取得
- `src/concerts/mutations.ts`: `ConcertInput.note`
- `src/routes/_authed/admin/settings.tsx`: 管理者メールフォーム
- `src/routes/_authed/admin/concerts.tsx`: 備考・資料管理UI
- `src/routes/_authed/index.tsx`: 備考・資料・問い合わせ・地図・カレンダー
- `src/routes/_authed/practices.tsx`: 練習カレンダーへ演奏会名を渡す
- `src/components/practice-item.tsx`: 練習の地図・カレンダー導線
- `src/routes/_authed/admin/practices.tsx`: 複製して編集
- `src/auth/functions.ts`: ログイン成功時の掃除
- `src/auth/rate-limit.ts`: 掃除タイミングのコメント
- `src/test/db.ts`: D1バッチを直接使わないテスト方針の説明
- `.cursor/rules/database.mdc`: テーブル数と未使用 `link_checks` の説明
- `docs/tasks.md`: Phase 5完了記録

---

### Task 1: T5-1 スキーマ・マイグレーション・アクセス層

**Files:**
- Modify: `src/lib/limits.ts`
- Modify: `src/db/schema.ts`
- Create: `migrations/0001_phase_5_usability.sql`
- Create: `migrations/meta/0001_snapshot.json`
- Modify: `migrations/meta/_journal.json`
- Create: `src/settings/queries.ts`
- Create: `src/settings/mutations.ts`
- Create: `src/settings/mutations.test.ts`
- Create: `src/concert-resources/queries.ts`
- Create: `src/concert-resources/mutations.ts`
- Create: `src/concert-resources/mutations.test.ts`
- Modify: `src/concerts/queries.ts`
- Modify: `src/concerts/mutations.ts`
- Modify: `src/concerts/mutations.test.ts`

**Interfaces:**
- Produces: `getAppSettings(db: Db): Promise<{ adminEmail: string | null }>`
- Produces: `updateAdminEmail(db: Db, adminEmail: string | null): Promise<void>`
- Produces: `listConcertResources(db: Db, concertId: number): Promise<ConcertResource[]>`
- Produces: `listConcertResourcesByConcert(db: Db, concertIds: readonly number[]): Promise<Map<number, ConcertResource[]>>`
- Produces: `createConcertResource`, `updateConcertResource`, `moveConcertResource`, `deleteConcertResource`
- Produces: `ConcertInput.note: string | null`

- [ ] **Step 1: DBロジックの失敗するテストを書く**

`src/settings/mutations.test.ts` に、行が無い状態の `getAppSettings()` が `{ adminEmail: null }` を返し、`updateAdminEmail()` が初回作成、上書き、`null`解除を行うテストを書く。

`src/concert-resources/mutations.test.ts` に、次のテストを書く。

```ts
it('登録順に並び、6件目を拒否する', async () => {
  for (let index = 1; index <= MAX_CONCERT_RESOURCES; index += 1) {
    await createConcertResource(db, 1, {
      title: `資料${index}`,
      url: `https://example.com/${index}`,
    })
  }
  await expect(
    createConcertResource(db, 1, {
      title: '資料6',
      url: 'https://example.com/6',
    }),
  ).rejects.toThrow(CONCERT_RESOURCE_LIMIT_MESSAGE)
  expect((await listConcertResources(db, 1)).map(({ title }) => title)).toEqual([
    '資料1',
    '資料2',
    '資料3',
    '資料4',
    '資料5',
  ])
})
```

同じファイルに編集、上下移動、別演奏会を巻き込まないこと、削除のテストを加える。`src/concerts/mutations.test.ts` には `note` の保存と、演奏会削除時に `concert_resources` がCASCADEされるテストを加える。

- [ ] **Step 2: テストが未定義シンボルで失敗することを確認する**

Run: `pnpm test src/settings/mutations.test.ts src/concert-resources/mutations.test.ts src/concerts/mutations.test.ts`

Expected: `appSettings`、`concertResources`、アクセス関数が未定義のため FAIL。

- [ ] **Step 3: 上限定数とスキーマを追加する**

`src/lib/limits.ts` に次を追加する。

```ts
concertNote: 2000,
resourceTitle: 100,
adminEmail: 254,
```

同ファイルから次を export する。

```ts
export const MAX_CONCERT_RESOURCES = 5
```

`src/db/schema.ts` に `concerts.note`、`concertResources`、`appSettings` と infer 型を追加する。索引名は `concert_resources_concert_sort_idx` とし、外部キーは `onDelete: 'cascade'` にする。

- [ ] **Step 4: マイグレーションを生成・確認する**

Run: `pnpm db:generate --name phase_5_usability`

Expected: `migrations/0001_phase_5_usability.sql` とメタデータが生成され、SQLは `concerts` への nullable列追加と2テーブル作成だけを含む。

Run: `pnpm db:migrate`

Expected: ローカルD1へ `0001_phase_5_usability.sql` が適用される。

- [ ] **Step 5: 設定アクセス層を実装する**

`src/settings/queries.ts` は行が無い場合も同じ戻り型にする。

```ts
export async function getAppSettings(db: Db): Promise<AppSettingsView> {
  const [row] = await db
    .select({ adminEmail: appSettings.adminEmail })
    .from(appSettings)
    .where(eq(appSettings.id, 1))
    .limit(1)
  return row ?? { adminEmail: null }
}
```

`src/settings/mutations.ts` は `id: 1` で `onConflictDoUpdate` し、`updatedAt` を現在UTCへ更新する。

- [ ] **Step 6: 資料アクセス層を実装する**

`src/concert-resources/queries.ts` では `sortOrder`, `id` 順に取得し、複数演奏会分は `inArray` 1回で取得して `Map` にまとめる。空のID配列ではDBを呼ばず空の `Map` を返す。

`src/concert-resources/mutations.ts` は次の定数を export する。

```ts
export const CONCERT_RESOURCE_LIMIT_MESSAGE =
  `資料は${MAX_CONCERT_RESOURCES}件まで登録できます`
```

作成前に対象演奏会の件数を `count()` し、上限以上ならこのエラーを投げる。末尾の `sortOrder` は最大値+1、移動は `reorderRows()`、編集はタイトルとURLだけを更新する。

- [ ] **Step 7: 演奏会アクセス層へ備考と資料件数を加える**

`ConcertInput`、`ConcertOverview`、`ConcertAdminItem` に `note` を追加する。管理一覧は資料を別の一括クエリで取得し、各項目へ `resources` と `resourceCount` を設定する。練習・曲の件数は既存の `countDistinct` を維持する。

- [ ] **Step 8: DBロジックのテストを通す**

Run: `pnpm test src/settings/mutations.test.ts src/concert-resources/mutations.test.ts src/concerts/mutations.test.ts src/concerts/queries.test.ts`

Expected: 追加・既存テストが PASS。

- [ ] **Step 9: 全検査とコミット**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: Biome、型検査、全Vitestが PASS。

```bash
git add src/lib/limits.ts src/db/schema.ts migrations src/settings src/concert-resources src/concerts
git commit -m "T5-1: 設定と演奏会資料のデータ基盤を追加する" \
  -m "問い合わせ先と演奏会資料を後続画面から一貫して扱い、資料件数と並び順をDBアクセス層で強制するため。"
```

---

### Task 2: T5-2 管理者メールアドレスの設定

**Files:**
- Modify: `src/lib/validation.ts`
- Modify: `src/lib/validation.test.ts`
- Modify: `src/routes/_authed/admin/settings.tsx`

**Interfaces:**
- Produces: `optionalEmail: ZodPipe<...>`（空欄を `null` に変換）
- Consumes: `getAppSettings`, `updateAdminEmail`

- [ ] **Step 1: メール検証の失敗するテストを書く**

`src/lib/validation.test.ts` に正常なメール、前後空白、空欄→`null`、形式不正、255文字の拒否を追加する。

- [ ] **Step 2: テストが失敗することを確認する**

Run: `pnpm test src/lib/validation.test.ts`

Expected: `optionalEmail` が未定義で FAIL。

- [ ] **Step 3: 共通メール検証を実装する**

`MESSAGES.email` を `メールアドレスの形式で入力してください` とし、次のスキーマを追加する。

```ts
const email = z.email({ error: MESSAGES.email })

export const optionalEmail = z
  .string()
  .trim()
  .max(MAX_LENGTH.adminEmail, tooLong(MAX_LENGTH.adminEmail))
  .refine(
    (value) => value === '' || email.safeParse(value).success,
    MESSAGES.email,
  )
  .transform(blankToNull)
```

- [ ] **Step 4: 設定画面へメールフォームを追加する**

ローダーを `Promise.all([listCredentials(db), getAppSettings(db)])` に変更する。`submitAdminEmail` は `requireAdmin` と `z.object({ adminEmail: optionalEmail })` を使う。

`AdminEmailForm` は `type="email"`、`autoComplete="email"`、初期値、保存成功通知を持つ。パスワード入力は追加しない。空欄保存で解除できる説明を表示する。

- [ ] **Step 5: 検査とコミット**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: 全検査が PASS。

```bash
git add src/lib/validation.ts src/lib/validation.test.ts src/routes/_authed/admin/settings.tsx
git commit -m "T5-2: 管理者メールを設定画面から変更可能にする" \
  -m "問い合わせ導線を運用中に有効化・解除でき、DBへ不正なメール形式を保存させないため。"
```

---

### Task 3: T5-3 管理者への問い合わせ導線

**Files:**
- Create: `src/lib/external-urls.ts`
- Create: `src/lib/external-urls.test.ts`
- Modify: `src/routes/_authed/index.tsx`

**Interfaces:**
- Produces: `buildInquiryMailtoUrl(email: string, concertName: string): string`
- Consumes: `getAppSettings`

- [ ] **Step 1: `mailto:` の失敗するテストを書く**

次の期待値を固定する。

```ts
const url = buildInquiryMailtoUrl(
  'admin@example.com',
  '第10回 定期&特別演奏会',
)
const parsed = new URL(url)
expect(parsed.protocol).toBe('mailto:')
expect(parsed.pathname).toBe('admin@example.com')
expect(parsed.searchParams.get('subject')).toBe(
  '【第10回 定期&特別演奏会】エキストラからの問い合わせ',
)
expect(parsed.searchParams.get('body')).toBe(
  '演奏会名：第10回 定期&特別演奏会\n氏名：\n問い合わせ内容：',
)
```

- [ ] **Step 2: 未実装による失敗を確認する**

Run: `pnpm test src/lib/external-urls.test.ts`

Expected: モジュール未作成で FAIL。

- [ ] **Step 3: URL生成関数を実装する**

`URLSearchParams` で `subject` と `body` を構築し、宛先は設定済みメール検証を通った値として `mailto:${email}?${params}` を返す。

- [ ] **Step 4: ダッシュボードへ問い合わせを追加する**

`getDashboard` で設定を並列取得し、`adminEmail` がある場合だけ出欠の後に「管理者へ問い合わせる」を表示する。演奏会が存在しない場合は表示しない。

- [ ] **Step 5: 検査とコミット**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: 全検査が PASS。

```bash
git add src/lib/external-urls.ts src/lib/external-urls.test.ts src/routes/_authed/index.tsx
git commit -m "T5-3: 演奏会名入りの問い合わせ導線を追加する" \
  -m "問い合わせ内容を保持せず、端末のメールアプリだけで管理者へ連絡できるようにするため。"
```

---

### Task 4: T5-4 演奏会備考と資料リンクの管理

**Files:**
- Modify: `src/routes/_authed/admin/concerts.tsx`
- Create: `src/concerts/input.ts`
- Create: `src/concerts/input.test.ts`

**Interfaces:**
- Consumes: `ConcertAdminItem.resources`
- Consumes: 資料CRUD関数と `MAX_CONCERT_RESOURCES`

- [ ] **Step 1: 備考入力検証の失敗するテストを書く**

`src/concerts/input.test.ts` に、複数行の備考を保持すること、空欄を `null` にすること、2001文字を拒否することを追加する。

- [ ] **Step 2: 入力モジュール未作成で失敗することを確認する**

Run: `pnpm test src/concerts/input.test.ts`

Expected: `src/concerts/input.ts` が存在しないため FAIL。

- [ ] **Step 3: 共有入力と備考欄を追加する**

`src/concerts/input.ts` に現在の `concertInput` を移し、`note: optionalText(MAX_LENGTH.concertNote)` を追加して export する。管理ルートはこのスキーマを import し、フォーム state、送信値、保存後リセットへ反映する。入力は `textarea rows={6}`、ヒントは「集合時間、服装、持ち物など」とする。

- [ ] **Step 4: 資料サーバ関数を追加する**

`addResource`、`editResource`、`moveResource`、`removeResource` をすべて `requireAdmin` 付きで定義する。入力は資料タイトル、HTTP(S) URL、正のID、`DIRECTIONS` を使う。

- [ ] **Step 5: 資料管理UIを追加する**

各演奏会項目へ `ResourceSection` を追加する。資料ごとに外部リンク、編集、↑、↓、削除を表示する。編集時は同じ場所に `ResourceForm` を開き、追加時は一覧末尾に開く。5件時は追加ボタンを無効にして「資料は5件まで登録できます」を表示する。

削除確認文は資料リンクだけを消し外部ファイルは残ることを示す。演奏会削除警告には資料件数を加える。

- [ ] **Step 6: 検査とコミット**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: 全検査が PASS。

```bash
git add src/routes/_authed/admin/concerts.tsx src/concerts/input.ts src/concerts/input.test.ts
git commit -m "T5-4: 演奏会の備考と資料を管理可能にする" \
  -m "集合情報と最大5件の外部資料を演奏会単位で更新し、削除や並び順も管理画面だけで完結させるため。"
```

---

### Task 5: T5-5 ダッシュボードへの備考・資料表示

**Files:**
- Modify: `src/concerts/queries.test.ts`
- Modify: `src/routes/_authed/index.tsx`

**Interfaces:**
- Consumes: `ConcertOverview.note`
- Consumes: `listConcertResources`

- [ ] **Step 1: overviewと資料順のテストを追加する**

`src/concerts/queries.test.ts` で複数行の備考が返ることを確認する。資料アクセス層テストでは `sortOrder` 順を既に固定しているため、ダッシュボード用に重複した並べ替えテストは追加しない。

- [ ] **Step 2: ダッシュボード取得へ資料を追加する**

`getDashboard` の `Promise.all` に `listConcertResources(db, concertId)` を加える。演奏会が存在しない場合も資料の空配列を安全に返す。

- [ ] **Step 3: 備考と資料を表示する**

次の練習の後、出欠の前に備考と資料を配置する。備考は `className="detail"` で改行を保持し、資料は `link-list` と `ExternalLink` を使う。値が空なら見出しを含めてレンダーしない。

- [ ] **Step 4: 検査とコミット**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: 全検査が PASS。

```bash
git add src/concerts/queries.test.ts src/routes/_authed/index.tsx
git commit -m "T5-5: ダッシュボードに演奏会備考と資料を表示する" \
  -m "当日に必要な補足と資料を登録順で確認でき、未登録項目で画面を散らかさないため。"
```

---

### Task 6: T5-6 Google Maps 導線

**Files:**
- Modify: `src/lib/external-urls.ts`
- Modify: `src/lib/external-urls.test.ts`
- Modify: `src/components/practice-item.tsx`
- Modify: `src/routes/_authed/index.tsx`

**Interfaces:**
- Produces: `buildGoogleMapsUrl(address: string): string`

- [ ] **Step 1: Maps URLの失敗するテストを書く**

```ts
expect(buildGoogleMapsUrl('東京都 千代田区1-1 &別館')).toBe(
  'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('東京都 千代田区1-1 &別館'),
)
```

- [ ] **Step 2: 未実装による失敗を確認する**

Run: `pnpm test src/lib/external-urls.test.ts`

Expected: `buildGoogleMapsUrl` が未定義で FAIL。

- [ ] **Step 3: Maps URLと表示を実装する**

住所を `encodeURIComponent` して仕様の固定URLへ連結する。ダッシュボードの本番会場、`PracticeItem` の会場住所直後に「Google Mapsで開く」を `ExternalLink` で表示する。会場が無い場合はリンクも出さない。

- [ ] **Step 4: 検査とコミット**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: 全検査が PASS。

```bash
git add src/lib/external-urls.ts src/lib/external-urls.test.ts src/components/practice-item.tsx src/routes/_authed/index.tsx
git commit -m "T5-6: 本番と練習会場の地図導線を追加する" \
  -m "APIキーを持たずに登録住所からGoogle Mapsを開き、移動時の検索入力を省くため。"
```

---

### Task 7: T5-7 Google Calendar 導線

**Files:**
- Modify: `src/lib/external-urls.ts`
- Modify: `src/lib/external-urls.test.ts`
- Modify: `src/components/practice-item.tsx`
- Modify: `src/routes/_authed/index.tsx`
- Modify: `src/routes/_authed/practices.tsx`

**Interfaces:**
- Produces: `buildPerformanceCalendarUrl(input): string | null`
- Produces: `buildPracticeCalendarUrl(input): string | null`
- Changes: `PracticeItem({ practice, concertName })`

- [ ] **Step 1: Calendar URLの失敗するテストを書く**

本番 `2026-12-31` が `dates=20261231/20270101`、閏日 `2028-02-29` が `20280229/20280301` になることを確認する。練習は両時刻ありで `20260801T130000/20260801T170000` と `ctz=Asia/Tokyo`、片方欠けで終日になることを確認する。タイトルと `会場名 住所` が `URL.searchParams` から元の日本語へ戻ることも確認する。

- [ ] **Step 2: 未実装による失敗を確認する**

Run: `pnpm test src/lib/external-urls.test.ts`

Expected: Calendar関数未定義で FAIL。

- [ ] **Step 3: 日付文字列ヘルパーを実装する**

`YYYY-MM-DD` を数値へ分解し、閏年と月の日数から翌日を返す純関数をファイル内に置く。日付検証は正規表現と月日範囲で行い、`Date` は使わない。時刻は `HH:MM` の正規表現で検証する。

- [ ] **Step 4: Calendar URL生成を実装する**

ベースURLへ `action=TEMPLATE`、`text`、`dates`、会場がある場合の `location` を `URLSearchParams` で設定する。時刻入り練習だけ `ctz=Asia/Tokyo` を加える。不正日付は `null` を返す。

- [ ] **Step 5: 本番と練習へリンクを表示する**

ダッシュボードは本番日がある場合に「Googleカレンダーに追加」を表示する。`PracticeItem` に `concertName` を必須で渡し、ダッシュボードと練習一覧の両方から同じ練習URLを生成する。

- [ ] **Step 6: 検査とコミット**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: 全検査が PASS。

```bash
git add src/lib/external-urls.ts src/lib/external-urls.test.ts src/components/practice-item.tsx src/routes/_authed/index.tsx src/routes/_authed/practices.tsx
git commit -m "T5-7: 本番と練習のカレンダー登録導線を追加する" \
  -m "日本時間文字列を変換せず予定URLへ反映し、会場情報付きの予定を端末から作れるようにするため。"
```

---

### Task 8: T5-8 練習の「複製して編集」

**Files:**
- Create: `src/practices/duplicate.ts`
- Create: `src/practices/duplicate.test.ts`
- Modify: `src/routes/_authed/admin/practices.tsx`

**Interfaces:**
- Produces: `duplicatePracticeValues(practice: PracticeAdminItem): PracticeFormValues`

- [ ] **Step 1: 引継ぎ項目の失敗するテストを書く**

元の練習に日付・時刻・会場・詳細・録音を設定し、戻り値が次と一致することを確認する。

```ts
expect(duplicatePracticeValues(source)).toEqual({
  date: '',
  startTime: '18:30',
  endTime: '21:00',
  venueId: '3',
  detail: '合奏',
})
```

戻り値に `id` と `media` が無いことを型と値で固定する。

- [ ] **Step 2: 未実装による失敗を確認する**

Run: `pnpm test src/practices/duplicate.test.ts`

Expected: モジュール未作成で FAIL。

- [ ] **Step 3: 複製値の純関数を実装する**

フォームが扱う文字列型へ変換し、nullable値は空文字にする。日付は常に空文字とする。

- [ ] **Step 4: 管理画面の複製UIを実装する**

`AdminPracticesPage` に複製値と再選択用カウンタの state、上部フォームを囲む ref を持たせる。各 `AdminPracticeItem` の「複製して編集」からコールバックを呼ぶ。上部 `PracticeForm` は `initialValues` を受け、カウンタを `key` にして同じ元を再選択してもリセットする。

state反映後の `useEffect` で `scrollIntoView({ behavior: 'smooth', block: 'start' })` を呼び、日付入力へ `focus()` する。複製ボタンではサーバ関数を呼ばない。

- [ ] **Step 5: 検査とコミット**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: 全検査が PASS。

```bash
git add src/practices/duplicate.ts src/practices/duplicate.test.ts src/routes/_authed/admin/practices.tsx
git commit -m "T5-8: 練習を複製して新規編集できるようにする" \
  -m "毎回同じ時刻・会場・詳細を再入力せず、日付と録音だけを新しい練習固有の情報として扱うため。"
```

---

### Task 9: T5-9 ログイン成功時の認証データ掃除

**Files:**
- Create: `src/auth/cleanup.ts`
- Create: `src/auth/cleanup.test.ts`
- Modify: `src/auth/functions.ts`
- Modify: `src/auth/rate-limit.ts`
- Modify: `src/test/db.ts`

**Interfaces:**
- Produces: `buildAuthCleanupStatements(db: Db, now: Date)`
- Produces: `cleanupAuthData(db: Db, now: Date): Promise<void>`

- [ ] **Step 1: 削除境界の失敗するテストを書く**

期限切れ・有効なセッション、7日より古い・ちょうど7日前・新しいログイン試行を投入する。`buildAuthCleanupStatements()` の2文をテストDBで順に実行し、期限切れと7日より古い行だけが消えることを確認する。

- [ ] **Step 2: 未実装による失敗を確認する**

Run: `pnpm test src/auth/cleanup.test.ts`

Expected: cleanupモジュール未作成で FAIL。

- [ ] **Step 3: 削除文とD1バッチを実装する**

期限切れセッションは `lte(sessions.expiresAt, now.toISOString())`、ログイン試行は `lt(loginAttempts.attemptedAt, cutoff.toISOString())` で削除する。`cleanupAuthData` は返した2文を `db.batch()` へ渡し、D1側で同じトランザクションとして実行する。

`sqlite-proxy` のテストDBはD1バッチを再現しないため、単体テストでは2文そのものを順に実行する。この差を `src/test/db.ts` のコメントへ明記する。

- [ ] **Step 4: ログイン成功時だけ呼ぶ**

`issueSession()` の戻り値を変数に保持し、発行後に `cleanupAuthData(db, now)`、その後に `writeSessionCookie(token)` を行う。ロール不一致とレート制限の早期returnより後にだけ置く。`src/auth/rate-limit.ts` のCronコメントをログイン成功時へ直す。

- [ ] **Step 5: 検査とコミット**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: 全検査が PASS。

```bash
git add src/auth/cleanup.ts src/auth/cleanup.test.ts src/auth/functions.ts src/auth/rate-limit.ts src/test/db.ts
git commit -m "T5-9: ログイン成功時に古い認証データを掃除する" \
  -m "低頻度利用のために定期実行基盤を増やさず、期限切れセッションと不要な試行履歴の蓄積を抑えるため。"
```

---

### Task 10: Phase 5 統合確認と進捗更新

**Files:**
- Modify: `.cursor/rules/database.mdc`
- Modify: `docs/tasks.md`
- Inspect: `README.md`

**Interfaces:**
- Consumes: T5-1〜T5-9の全成果物
- Produces: Phase 5完了記録と次タスク `T6-1`

- [ ] **Step 1: 陳腐化したDBルールを直す**

テーブル数を11へ更新し、`link_checks` は今回未使用でデータを作らず、Cron掃除もしない説明へ変更する。

- [ ] **Step 2: 全自動検査を実行する**

Run: `pnpm lint && pnpm typecheck && pnpm test`

Expected: Biome、TypeScript、全Vitestが PASS。

Run: `pnpm build`

Expected: SPAとWorkerのproduction buildが成功する。

- [ ] **Step 3: ローカルD1を準備する**

Run: `pnpm db:migrate && pnpm db:seed`

Expected: マイグレーションとseedが成功し、管理者・エキストラでログイン可能な初期状態になる。

- [ ] **Step 4: 390px幅で管理者導線を手動確認する**

`pnpm dev` をtmuxで起動し、computerUseで次を操作する。

1. 管理者でログイン
2. 設定画面でメールを保存
3. 演奏会へ複数行備考と資料2件を登録
4. 資料を編集・上下移動し、表示順を確認
5. 練習を複製し、日付が空、時刻・会場・詳細が継承、録音が未継承であることを確認
6. 保存前後の一覧件数から、保存時だけ練習が増えることを確認

- [ ] **Step 5: エキストラ閲覧導線を録画する**

エキストラでログインし、演奏会備考、資料順、問い合わせ、Maps、Calendar、練習一覧の地図・カレンダーを確認する。成功した操作だけを `/opt/cursor/artifacts/phase_5_usability_walkthrough.mp4` に保存し、videoReviewで内容を検証する。

- [ ] **Step 6: メール解除と空状態を確認する**

管理者でメールを空欄保存し、備考と資料を削除する。エキストラ画面で問い合わせ・備考・資料の各セクションが表示されないことを確認する。確認後、手動テストに使ったローカルデータは残す。

- [ ] **Step 7: 進捗とREADMEを更新する**

`docs/tasks.md` の進捗へPhase 5完了日、T5-1〜T5-9、実動確認内容、ADR-0016を記録し、次に着手できるものを `T6-1` とする。Phase 5見出しへ「（完了）」を付ける。

`README.md` は構成・コマンド・セットアップに変更がないことを確認し、不整合が無ければ編集しない。

- [ ] **Step 8: 最終検査とコミット**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`

Expected: 全検査とproduction buildが PASS。

```bash
git add .cursor/rules/database.mdc docs/tasks.md
git commit -m "Phase 5の完了と運用ルールを記録する" \
  -m "実装済みの11テーブル構成と認証掃除の運用を文書へ一致させ、次のUI刷新へ進める状態を明確にするため。"
```

- [ ] **Step 9: pushとPR更新**

Run: `git push -u origin cursor/phase-5-implementation-b3d9`

Expected: 全コミットがリモートへ送信される。PR本文をテンプレートの4見出しで更新し、自動検査、手動確認、動画、A-7を記載する。
