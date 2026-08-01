# improve-react 計画一覧

監査コミット: `90a50e7`（React Doctor 0.9.2 / effort: standard）  
成果物の置き場: 本ディレクトリ（ユーザー指定）

実行は **読み取り専用監査のあと**、エージェントまたは人手で各計画を実装する。実装時は各計画の Boundaries を守ること。

## 推奨実行順

| 順 | Plan | Status | Severity | 依存 |
| --- | --- | --- | --- | --- |
| 1 | [001-piece-create-form-concert-key.md](./001-piece-create-form-concert-key.md) | DONE | HIGH | なし |
| 2 | [002-confirm-dialog-accessible-name.md](./002-confirm-dialog-accessible-name.md) | DONE | HIGH | なし（007 が ConfirmButton を触るので先に済ませると楽） |
| 3 | [003-nav-aria-current.md](./003-nav-aria-current.md) | DONE | HIGH | なし |
| 4 | [005-bulk-venue-dialog-a11y.md](./005-bulk-venue-dialog-a11y.md) | TODO | MEDIUM | 009 より先が望ましい |
| 5 | [004-admin-form-refresh-failure.md](./004-admin-form-refresh-failure.md) | TODO | MEDIUM | なし |
| 6 | [007-specific-edit-delete-aria-labels.md](./007-specific-edit-delete-aria-labels.md) | TODO | MEDIUM | 002 推奨先行 |
| 7 | [006-pnpm-supply-chain-hardening.md](./006-pnpm-supply-chain-hardening.md) | TODO | MEDIUM | なし（アプリ UI と独立） |
| 8 | [008-trim-google-font-weights.md](./008-trim-google-font-weights.md) | TODO | MEDIUM | なし（計測あり） |
| 9 | [009-extract-bulk-practice-ui.md](./009-extract-bulk-practice-ui.md) | TODO | MEDIUM | 005 推奨先行 |
| 10 | [010-external-link-new-tab-announce.md](./010-external-link-new-tab-announce.md) | TODO | LOW | なし |
| 11 | [011-extract-concert-resource-ui.md](./011-extract-concert-resource-ui.md) | TODO | LOW | 007 を Resource 呼び出しに入れた後ならその差分を維持 |

## 並列可能な束

- **A（正しさ）**: 001, 004
- **B（a11y 小粒）**: 002, 003, 005, 010（002→007 は直列推奨）
- **C（供給連鎖）**: 006
- **D（perf）**: 008
- **E（分割）**: 009, 011（ファイル衝突に注意。practices / concerts は別ファイルなので並列可）

## 監査で却下したもの（計画化しない）

- `async-await-in-loop`（ADR-0011 / 無料枠の意図）
- `js-combine-iterations`
- `prefer-useReducer`
- ルート内の小さな `no-multi-comp` 大半
- `only-export-components`（意図的な共有モジュール）

## Missed opportunities（未計画・任意）

スキャナ外の能力追加。必要なら別計画を起こす。

1. 一括フォームの submit を `useAdminForm` に寄せる（004 と相性）
2. `getNextPractice` の practice→media 2段クエリを1クエリ化
3. フォント self-host / preload（008 の follow-up）
