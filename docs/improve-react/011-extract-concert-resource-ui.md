# 011 — 演奏会画面から資料（Resource）UI を切り出す

- **Status**: DONE
- **Commit**: 90a50e7
- **Severity**: LOW
- **Category**: Maintainability & architecture
- **Rule**: `react-doctor/no-multi-comp`
- **Estimated scope**: 2 files, 中

## Problem

`src/routes/_authed/admin/concerts.tsx`（約 579 行）に `ResourceSection` / `ResourceItem` / `ResourceForm`（約 :261–422）が埋まり、演奏会 CRUD と資料 CRUD の変更が同じモジュールで衝突する。

Canonical:

> Move each secondary component into its own file and import it…

`ConcertItem` / `ConcertForm` のコロケーションは許容（reject 済み）。**Resource\* クラスタのみ**を切る。

## Target

安全な置き場の例:

```
src/components/concert-resource-admin.tsx
  // or src/concert-resources/admin-ui.tsx
```

```tsx
// concerts.tsx — target usage inside ConcertItem
<ResourceSection concert={concert} />
```

移動対象:

- `ResourceSection`（:261）
- `ResourceItem`（:306）
- `ResourceForm`（:367）
- 必要な型（`ConcertResourceItem` 等）と、これらが使う server fn（`addResource` / `editResource` / `moveResource` / `removeResource`）の import

server fn 定義が `concerts.tsx` 上部にあるなら、定義は route に残して UI だけ渡す／import する形でよい。可能なら `src/concert-resources/` の既存 mutations を UI から `useServerFn` で呼ぶ現状を維持。

## Repo conventions to follow

- 画面から `src/db/schema.ts` を読まない
- `AdminRowActions` / `ExternalLink` / `useAdminForm` の使い方は現状どおり
- 007 の aria-label を Resource 側に既に入れている場合は、切り出し時にその props を落とさない

## Steps

1. Resource\* を新モジュールへ移動し export
2. `concerts.tsx` から import して `<ResourceSection />` を残す
3. ルートファイルを増やさない（Router に拾われないパス）
4. 動作確認（資料の追加・編集・並べ替え・削除）

## Boundaries

- Do NOT ConcertForm を useReducer 化する（prefer-useReducer は却下済み）
- Do NOT 資料の上限や文言を変える
- Do NOT practices の MediaSection まで同梱する
- STOP if Resource が既に別ファイルへ移っていたら reconcile して報告

## Verification

- **Mechanical**: `pnpm lint` / `pnpm typecheck` / `pnpm test`。React Doctor の concerts 向け `no-multi-comp` が減ること
- **Behavior check**: 管理 → 演奏会で資料リンクの CRUD・並べ替えが stamp 時と同じこと
- **Done when**: Resource UI が別ファイルにあり、concerts ルートが演奏会本体中心になっている
