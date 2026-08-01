# 009 — 練習管理から一括追加 UI を切り出す

- **Status**: TODO
- **Commit**: 90a50e7
- **Severity**: MEDIUM
- **Category**: Maintainability & architecture
- **Rule**: `react-doctor/no-multi-comp`
- **Estimated scope**: 2–4 files, 中〜大

## Problem

`src/routes/_authed/admin/practices.tsx` は約 944 行。練習 CRUD・メディア・一括追加・会場ダイアログが同居し、一括フローの変更が他領域と衝突しやすい。

React Doctor は複数コンポーネント宣言を `no-multi-comp` で報告する。Canonical:

> Move each secondary component into its own file and import it…

本計画では **レバレッジの高い bulk クラスタだけ**を切る（ファイル内の小さな Item/Form 全部をバラさない）。

切り出し対象（stamp の行目安）:

- `BulkPracticeForm`（約 :598–729）
- `BulkVenueCreateDialog`（約 :731–833）
- `BulkPracticeRowFields`（約 :835–）
- これらが依存する `BULK_BUSINESS_MESSAGES` / `venueInput` / bulk 用 server fn 参照

## Target

例（パスはリポジトリ慣習に合わせる）:

```
src/routes/_authed/admin/practices.tsx          # 一覧・単件 CRUD・Media を残す
src/routes/_authed/admin/-bulk-practice-form.tsx # または src/practices/bulk-*.tsx の UI 部分
```

推奨:

1. UI コンポーネントを `src/routes/_authed/admin/practices-bulk.tsx`（ルート走査に載らない名前なら `-practices-bulk.tsx` ではなく、routes 配下なら **ルートファイルにならない名前**に注意）。TanStack Router は `src/routes/` 配下の命名規則に敏感なので、**安全な置き場は `src/practices/bulk-ui.tsx` または `src/components/bulk-practice-form.tsx`**。
2. `practices.tsx` からは `<BulkPracticeForm concertId={...} venues={...} />` を import して使うだけにする。
3. server fn（`addPracticesBulk` / `addVenueFromBulk`）は route ファイルに残してもよいし、mutations 側へ寄せてもよい。寄せるなら既存の `src/practices/bulk.ts` パターンに従う。

挙動・文言・バリデーションは変えない。005（dialog a11y）が未適用なら、切り出し先に 005 の Target を同時適用してよい（依存: 005 を先にやるか、この計画に 005 を内包するかを実行時に選ぶ。README では 005 → 009 の順を推奨）。

## Repo conventions to follow

- ドメインロジックは既に `src/practices/bulk-form-state.ts` / `bulk-input.ts` / `bulk.ts`
- 画面から `schema.ts` を直接読まない
- テストファイル名が routes 配下なら `-` 始まり

## Steps

1. bulk 関連コンポーネントと必要な型・定数を新ファイルへ移動
2. `practices.tsx` の import / JSX を更新
3. 既存の bulk 関連テスト（`bulk-form-state.test.ts` 等）が通ることを確認。UI テストがあればパス更新
4. ルートツリー生成物を不用意に増やさない（誤って routes にページファイルを作らない）

## Boundaries

- Do NOT MediaSection / PracticeForm まで同時にバラす（必要なら別計画）
- Do NOT 一括の UX・上限メッセージを変える
- Do NOT 「コンポーネント数を減らすため」だけに無意味な統合をする
- STOP if Router が新ファイルをルートとして拾い始めたら配置をやり直す

## Verification

- **Mechanical**: `pnpm lint` / `pnpm typecheck` / `pnpm test`。`npx react-doctor@latest --scope changed` で practices 周りの `no-multi-comp` が減ること（ゼロ必須ではない）
- **Behavior check**: 管理 → 練習で単件追加・編集・削除・メディア・一括追加・一括内の会場新規がすべて stamp 時と同じこと
- **Done when**: bulk UI が別モジュールにあり、practices ルートの行数が明確に減り、回帰なし
