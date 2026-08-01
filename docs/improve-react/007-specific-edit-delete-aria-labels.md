# 007 — 編集・削除ボタンに対象を含む accessible name を付ける

- **Status**: TODO
- **Commit**: 90a50e7
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Rule**: Beyond the scan（`design-no-vague-button-label` の精神。公式ルールの静的語彙リストには「編集」「削除」は含まれない）
- **Estimated scope**: 複数ファイル, 中

## Problem

管理一覧の「編集」「削除」は可視ラベルが汎用で、スクリーンリーダーのボタンローターに同名が並ぶ。並べ替えは既に `「{title}」を上へ` のような具体名がある。

```tsx
// src/components/admin-row-actions.tsx:33-41 — current defaults
editLabel = '編集',
deleteLabel = '削除',
```

設計（T9-2 / コメント）は**見た目の短さ**を優先しているので、可視テキストを長くしない。`aria-label` で accessible name だけ具体化する。

Canonical（vague label の趣旨）:

> Name the action that will happen… The visible label IS the accessible name…

本リポジトリでは密度制約があるため、**可視は短く・aria-label は具体**とする（並べ替えアイコンと同じ手法）。

## Target

### `ConfirmButton`

トリガーに任意の accessible name を渡せるようにする:

```tsx
// confirm-button.tsx — target props
type ConfirmButtonProps = {
  label: string
  /** 省略時は label が accessible name */
  labelAriaLabel?: string
  title: string
  // ...
}

<Button
  ...
  {...(labelAriaLabel !== undefined
    ? { 'aria-label': labelAriaLabel }
    : {})}
>
  {label}
</Button>
```

### `AdminRowActions`

```tsx
// props — target
editLabel?: string // 既定 '編集'（可視）
editAriaLabel?: string
deleteLabel?: string // 既定 '削除'
deleteAriaLabel?: string

// SecondaryButton
<SecondaryButton
  disabled={disabled}
  onClick={onEdit}
  {...(editAriaLabel !== undefined ? { 'aria-label': editAriaLabel } : {})}
>
  {editLabel}
</SecondaryButton>

// ConfirmButton
<ConfirmButton
  label={deleteLabel}
  {...(deleteAriaLabel !== undefined
    ? { labelAriaLabel: deleteAriaLabel }
    : {})}
  ...
/>
```

### 呼び出し側（例）

```tsx
// pieces.tsx AdminRowActions — target
editAriaLabel={`「${piece.title}」を編集`}
deleteAriaLabel={`「${piece.title}」を削除`}
```

同様に:

- `announcements.tsx`（title）
- `concerts.tsx` の `ResourceItem`（resource.title）
- `practices.tsx` の media `AdminRowActions`（link.title）— 編集なしでも deleteAriaLabel
- `practices.tsx:311-315` の `SecondaryButton` / `ConfirmButton`（日付など）
- `venues.tsx:121-125`（venue.name）
- `concerts.tsx:228-247` の ConcertItem（concert.name）

`SecondaryButton` は既に `'aria-label'?: string` を受け取る（`control-row.tsx:26`）。

## Repo conventions to follow

- 模範: `moveUpLabel={`「${piece.title}」を前へ`}`（`pieces.tsx:202`）
- 可視「編集」「削除」は維持（`admin-row-actions.test.tsx` の「ラベルを出す」期待を崩さない。aria-label の断言を追加）

## Steps

1. `ConfirmButton` に `labelAriaLabel` を追加
2. `AdminRowActions` に `editAriaLabel` / `deleteAriaLabel` を追加し配線
3. 全呼び出しとハードコードの編集/削除に具体 aria-label を渡す
4. `admin-row-actions.test.tsx` を更新（可視「編集」「削除」+ aria-label）
5. 見た目・レイアウトは変えない

## Boundaries

- Do NOT 可視ラベルを長い文言に置き換える（密度方針に反する）
- Do NOT 削除確認ダイアログの `title` 文言を変える（既に具体的）
- STOP if 呼び出し側で対象名が取れない行があれば報告する

## Verification

- **Mechanical**: `pnpm lint` / `pnpm typecheck` / `pnpm test`
- **Behavior check**: 管理一覧で編集/削除の見た目が「編集」「削除」のまま。DevTools / SR で accessible name が `「…」を編集` / `「…」を削除` であること
- **Done when**: AdminRowActions 経由とハードコード行の双方で具体名が付く
