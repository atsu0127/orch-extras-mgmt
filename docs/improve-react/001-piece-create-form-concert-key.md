# 001 — 曲追加フォームを演奏会切替で remount する

- **Status**: DONE
- **Commit**: 90a50e7
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan（AGENTS.md: 演奏会切替でフォーム state を初期化）
- **Estimated scope**: 2 files（route + test）, 小

## Problem

`src/routes/_authed/admin/pieces.tsx:94` の追加フォームに演奏会 `key` がなく、演奏会を切り替えても `PieceForm` の `useState` 初期値が残る。保存時は新しい `concertId` に古い下書きが載る。

```tsx
// src/routes/_authed/admin/pieces.tsx:94 — current
<PieceForm concertId={concert.id} />
```

対照（正）:

```tsx
// src/routes/_authed/admin/announcements.tsx:115-117
<AnnouncementForm
  key={announcementCreateFormKey(concert.id)}
  concertId={concert.id}
/>
```

## Target

```tsx
// src/routes/_authed/admin/pieces.tsx — target
/** 演奏会を切り替えたとき追加フォームの入力を残さない（AGENTS.md） */
export function pieceCreateFormKey(concertId: number): string {
  return String(concertId)
}

// ...
<PieceForm
  key={pieceCreateFormKey(concert.id)}
  concertId={concert.id}
/>
```

回帰テストは `src/routes/_authed/admin/-announcements.test.tsx` と同型で `src/routes/_authed/admin/-pieces.test.ts`（または `.tsx`）を追加する。ルート走査から外すためファイル名は `-` 始まり。

## Repo conventions to follow

- 模範: `src/routes/_authed/admin/announcements.tsx:82-86` / `-announcements.test.tsx`
- 練習一括は `src/practices/bulk-form-state.ts` の `bulkPracticeCreateFormKey` も同パターン
- 編集中フォーム（`PieceItem` 内）は対象外。追加フォームだけ

## Steps

1. `pieces.tsx` に `pieceCreateFormKey` を export し、追加の `<PieceForm>` に `key={pieceCreateFormKey(concert.id)}` を付ける
2. `src/routes/_authed/admin/-pieces.test.ts` に key の一意性テストを追加する
3. 無関係なリファクタはしない

## Boundaries

- Do NOT 変更 public API（サーバ関数・入力スキーマ）
- Do NOT 編集フォームや並び替え UI に手を入れる
- STOP if `pieces.tsx` の追加フォーム周りが stamp からずれていたら報告する

## Verification

- **Mechanical**: `pnpm lint` / `pnpm typecheck` / `pnpm test`（`-pieces.test` を含む）
- **Behavior check**: 管理 → 曲でタイトル等を入力 → ヘッダーで別演奏会へ切替 → 追加フォームが空であること。同じ演奏会に戻しても前の下書きが残らないこと
- **Done when**: key ヘルパーとテストがあり、切替後に下書きが残らない
