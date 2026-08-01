# 002 — ConfirmButton の dialog に accessible name を付ける

- **Status**: DONE
- **Commit**: 90a50e7
- **Severity**: HIGH
- **Category**: Accessibility
- **Rule**: `react-doctor/dialog-has-accessible-name`
- **Estimated scope**: 1–2 files, 小

## Problem

`src/components/confirm-button.tsx:53` の `<dialog>` に accessible name がない。管理画面の削除確認はほぼすべてここを通るため、スクリーンリーダーは「dialog」としか読まない。

```tsx
// src/components/confirm-button.tsx:53-57 — current
<dialog ref={dialog} className="confirm-dialog">
  <Stack gap="md">
    <Title order={2} size="h3">
      {title}
    </Title>
```

Canonical fix（React Doctor）:

> Give every `<dialog>` / `role="dialog"` an accessible name with `aria-label` or `aria-labelledby` (referencing the dialog's title element).

## Target

`aria-labelledby` で見出しへ接続する（`title` がそのまま名前になる）:

```tsx
// target
const titleId = useId()

<dialog ref={dialog} className="confirm-dialog" aria-labelledby={titleId}>
  <Stack gap="md">
    <Title id={titleId} order={2} size="h3">
      {title}
    </Title>
```

`useId` は既に React から使える。`Title` に `id` を渡せることは Mantine の DOM 出力で確認する（渡せない場合は見出しを `<h2 id={titleId}>` にするか、`aria-label={title}` を dialog に付ける）。

## Repo conventions to follow

- ネイティブ `<dialog>` + `showModal()` は ADR-0010。フォーカス閉じ込め・Esc の挙動は変えない
- 見た目のクラス `confirm-dialog` はそのまま

## Steps

1. `ConfirmButton` に `useId()` を追加し、`<dialog aria-labelledby={...}>` と見出しの `id` を配線する
2. 既存の `admin-row-actions.test.tsx` 等で壊れていないことを確認。必要なら「dialog に aria-labelledby がある」断言を足す
3. 無関係なスタイル変更はしない

## Boundaries

- Do NOT `role="dialog"` への置き換えやカスタムモーダル化
- Do NOT 確認文言・ボタンラベルの変更
- STOP if ConfirmButton の構造が stamp から大きく変わっていたら報告する

## Verification

- **Mechanical**: `npx react-doctor@latest --scope changed` で `dialog-has-accessible-name` が `confirm-button.tsx` から消える。`pnpm lint` / `pnpm typecheck` / `pnpm test`
- **Behavior check**: 管理の削除を開き、見出しが読めること。Esc / キャンセル / 確定のフォーカス挙動が以前どおりであること
- **Done when**: 診断クリア、削除確認の操作が変わらない
