# 003 — ナビと練習タブに aria-current を付ける

- **Status**: DONE
- **Commit**: 90a50e7
- **Severity**: HIGH
- **Category**: Accessibility
- **Rule**: Beyond the scan（現在位置のプログラム的告知）
- **Estimated scope**: 3 files, 小

## Problem

メインナビ・管理サブナビ・練習の「今後／過去」タブは見た目の `data-active` だけがあり、スクリーンリーダー向けの現在位置がない。

```tsx
// src/routes/_authed/route.tsx:319-325 — current (DesktopLink)
<Link
  to={to}
  activeOptions={{ exact }}
  activeProps={{ 'data-active': 'true' }}
  inactiveProps={{ 'data-active': 'false' }}
>
```

同様: `BottomLink`（:295）、`AdminEntryLink`（:261-264 の `data-active` 手動）、`src/routes/_authed/admin/route.tsx:44-47` の `AdminNavLink`、`src/routes/_authed/practices.tsx:57-70` の segmented リンク。

## Target

アクティブ時に `aria-current="page"` を付ける。見た目用の `data-active` は残す（ADR-0019）。

```tsx
// TanStack Link 系 — target
activeProps={{ 'data-active': 'true', 'aria-current': 'page' }}
inactiveProps={{ 'data-active': 'false' }}
```

```tsx
// AdminEntryLink（手動 active）— target
<Link
  to="/admin/concerts"
  aria-label="管理"
  data-active={active ? 'true' : 'false'}
  aria-current={active ? 'page' : undefined}
>
```

```tsx
// practices.tsx segmented — target
<Link
  ...
  data-active={view === 'upcoming' ? 'true' : 'false'}
  aria-current={view === 'upcoming' ? 'page' : undefined}
>
```

## Repo conventions to follow

- `data-active` によるスタイル切替は維持（`src/styles.css` / ADR-0019）
- `BottomLink` の `aria-label` / 可視ラベル分離は壊さない

## Steps

1. `route.tsx` の `DesktopLink` / `BottomLink` / `AdminEntryLink` に `aria-current` を追加
2. `admin/route.tsx` の `AdminNavLink` に同様
3. `practices.tsx` の今後／過去リンクに同様
4. 見た目用 CSS セレクタは触らない

## Boundaries

- Do NOT ナビ構造・ルート・ラベル文言の変更
- Do NOT `aria-current="true"` を使う（ページナビは `"page"`）
- STOP if Link の `activeProps` 型が stamp と食い違う場合は報告する

## Verification

- **Mechanical**: `pnpm lint` / `pnpm typecheck` / `pnpm test`
- **Behavior check**: デスクトップ／下部ナビで各タブを開き、アクティブなリンクだけ `aria-current="page"` があること。練習の今後／過去切替でも同様。見た目のアクティブ下線・ハイライトが変わらないこと
- **Done when**: 上記リンクすべてで現在位置が SR から分かる
