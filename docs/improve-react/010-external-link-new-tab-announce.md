# 010 — ExternalLink に新しいタブであることの告知を付ける

- **Status**: DONE
- **Commit**: 90a50e7
- **Severity**: LOW
- **Category**: Accessibility
- **Rule**: Beyond the scan（new-window announcement）
- **Estimated scope**: 2 files（component + test）, 小

## Problem

`src/components/external-link.tsx` は常に `target="_blank"` だが、スクリーンリーダー向けに「新しいタブで開く」ことを伝えていない。アイコンは `aria-hidden`。`rel="noopener noreferrer"` は正しい（セキュリティ上の問題ではない）。

```tsx
// external-link.tsx:44-60 — current (non-action)
<Anchor href={href} target="_blank" rel="noopener noreferrer" ...>
  <span className="external-link-label">{children}</span>
  <IconExternalLink ... aria-hidden />
</Anchor>
```

## Target

視覚的に隠した補足テキストを付ける（見た目は変えず、accessible name に含める）:

```tsx
// target — both action and non-action branches
{children}
<span className="visually-hidden">（新しいタブで開く）</span>
```

`visually-hidden` が `src/styles.css` に無ければ、既存のユーティリティに合わせる。無ければ最小のクラスを追加:

```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space:nowrap;
  border: 0;
}
```

（プロジェクトに同等クラスがあればそれを使う。新造は最後の手段。）

代替: リンク全体に `aria-label={`${text}（新しいタブで開く）`}` は children が ReactNode のとき壊れやすいので、visually-hidden の方が安全。

## Repo conventions to follow

- 外部リンクはすべて `ExternalLink` 経由（設計書 8.5）
- `pieces.tsx` の素の `<a target="_blank">` は本計画の必須範囲外（触るなら同じ告知を付ける）

## Steps

1. `ExternalLink` の両分岐に visually-hidden 文言を追加
2. `external-link.test.tsx` に「新しいタブで開く」を含む断言を追加
3. 可視レイアウトが崩れないことを確認

## Boundaries

- Do NOT `rel` / `target` / 色 / 下線を変える
- Do NOT アイコンを見えるテキストに置き換える
- STOP if 既存の `visually-hidden` 相当と衝突するクラス名があれば既存に合わせる

## Verification

- **Mechanical**: `pnpm lint` / `pnpm typecheck` / `pnpm test`
- **Behavior check**: ホームや曲の外部リンクで見た目がほぼ同じ。SR / Accessibility ツリーで名前に「新しいタブ」が含まれること
- **Done when**: テストとコンポーネントが更新され、見た目が崩れない
