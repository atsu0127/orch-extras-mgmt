# 008 — Google Fonts の読み込みウェイトを実使用に絞る

- **Status**: TODO
- **Commit**: 90a50e7
- **Severity**: MEDIUM
- **Category**: Performance
- **Rule**: Beyond the scan（first-paint / render-blocking CSS）
- **Estimated scope**: 1 file（`__root.tsx`）, 小（計測込み）

## Problem

全ページのシェルが Google Fonts をブロッキング stylesheet で読み込む。Sans は 400–700、Serif は 500–700 を要求しているが、実コードで使うウェイトは限定的。

```ts
// src/routes/__root.tsx:17-18, 36 — current
const FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&family=Noto+Serif+JP:wght@500;600;700&display=swap'
// ...
{ rel: 'stylesheet', href: FONT_CSS },
```

実使用の目安（stamp 時点）:

- Sans: 400（本文）、500（`Field` label）、600（各所 `fw={600}`）、700（ナビ・練習アイテム等）
- Serif: headings `fontWeight: '600'`（`theme.ts:49`）。500 / 700 の Serif 使用は見当たらない

## Target

まず **未使用 Serif ウェイトを落とす**（安全で小さい勝ち）:

```ts
// target
const FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&family=Noto+Serif+JP:wght@600&display=swap'
```

実行前に Lighthouse / WebPageTest 等で LCP またはフォント関連転送量の before を記録する。after も同じ条件で比較する。

self-host や preload への移行はこの計画の必須範囲外（効果が足りなければ follow-up）。

## Repo conventions to follow

- `preconnect` 2本は維持
- `display=swap` は維持
- テーマのフォントファミリー名は変えない（`theme.ts`）

## Steps

1. 本番または `pnpm preview` 相当で before メトリクスをメモ
2. `FONT_CSS` を上記に変更
3. 見出し（Serif）が想定どおり太さ 600 で出ることを目視
4. after メトリクスをメモ（計画の Verification に数値を残すか PR 説明に書く）

## Boundaries

- Do NOT この計画でフォントファイルをリポジトリに同梱する（self-host は別）
- Do NOT 色・レイアウト・テーマトークンを変える
- Do NOT Sans の 500 を落とす（Field label が使う）
- STOP if デザインが Serif 500/700 を明示要求していたら報告する

## Verification

- **Mechanical**: `pnpm lint` / `pnpm typecheck`（必要なら）。React Doctor 対象外
- **Behavior check**: ログイン後シェルで見出しが Serif・本文が Sans。フォールバックへの不用意な切り替えがないこと。Profiler ではなくネットワークでフォント CSS / woff2 の転送量が減っていること
- **Done when**: URL が絞られ、見た目が許容範囲で、before/after を記録した
