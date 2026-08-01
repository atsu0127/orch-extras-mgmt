# 005 — 一括会場ダイアログの名前付けとフォーカス復帰

- **Status**: DONE
- **Commit**: 90a50e7
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Rule**: `react-doctor/dialog-has-accessible-name` + Beyond the scan（focus return）
- **Estimated scope**: 1 file（`admin/practices.tsx`）, 小〜中

## Problem

`src/routes/_authed/admin/practices.tsx:785` の `BulkVenueCreateDialog` は:

1. `<dialog>` に accessible name がない（見出し「会場を新規追加」は未接続）
2. キャンセル / Esc が親の `onClose()` で **unmount** し、ネイティブ dialog の `.close()` を経由しないため、開く前のフォーカスに戻らない

```tsx
// practices.tsx:785-792, 822 — current
<dialog
  ref={dialog}
  className="confirm-dialog"
  onClose={onClose}
  onCancel={(event) => {
    event.preventDefault()
    if (!submitting) onClose()
  }}
>
// ...
<SecondaryButton disabled={submitting} onClick={onClose}>
  キャンセル
</SecondaryButton>
```

対照: `ConfirmButton` は `dialog.current?.close()` を使い、`onClose` イベントに任せる。

Canonical（dialog name）:

> Give every `<dialog>` … an accessible name with `aria-label` or `aria-labelledby`.

## Target

```tsx
// BulkVenueCreateDialog — target
const titleId = `${id}-venue-dialog-title`

useEffect(() => {
  dialog.current?.showModal()
}, [])

function requestClose() {
  if (!submitting) dialog.current?.close()
}

return (
  <dialog
    ref={dialog}
    className="confirm-dialog"
    aria-labelledby={titleId}
    onClose={onClose}
    onCancel={(event) => {
      event.preventDefault()
      requestClose()
    }}
  >
    <form onSubmit={onSubmit}>
      <Stack gap="md">
        <Title id={titleId} order={2} size="h3">
          会場を新規追加
        </Title>
        {/* fields unchanged */}
        <Group grow>
          <SecondaryButton disabled={submitting} onClick={requestClose}>
            キャンセル
          </SecondaryButton>
          {/* submit unchanged */}
        </Group>
      </Stack>
    </form>
  </dialog>
)
```

保存成功時も、親を落とす前に `dialog.current?.close()` するか、成功後に `onCreated` → 親が unmount する流れなら成功パスは現状維持でよい（フォーカスは行のセレクトへ戻すのが理想だが、必須はキャンセル/Esc）。

## Repo conventions to follow

- ADR-0010（ネイティブ dialog）
- `ConfirmButton`（`src/components/confirm-button.tsx`）の close パターンを模倣

## Steps

1. `aria-labelledby` と Title の `id` を配線
2. キャンセル / Esc を `.close()` 経由にし、`onClose` 属性で親へ通知
3. submitting 中は閉じないガードを維持
4. 見た目・フィールド・バリデーションは変えない

## Boundaries

- Do NOT この計画で `BulkPracticeForm` 全体を `useAdminForm` に寄せる（別機会）
- Do NOT practices.tsx の bulk 以外をリファクタ
- STOP if `BulkVenueCreateDialog` が別ファイルへ既に切り出されていたら、そのファイルを直す

## Verification

- **Mechanical**: `npx react-doctor@latest --scope changed` で `practices.tsx` の `dialog-has-accessible-name` が消える。`pnpm lint` / `pnpm typecheck` / `pnpm test`
- **Behavior check**: 練習一括 → 会場を新規追加を開き、キャンセルまたは Esc で閉じたあと、開く前の「会場を追加」相当コントロールへフォーカスが戻ること。ダイアログ名が「会場を新規追加」であること
- **Done when**: name + focus return が満たされ、保存フローも動く
