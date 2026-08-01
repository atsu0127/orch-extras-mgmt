# 004 — 保存成功後の refresh 失敗を保存失敗と誤表示しない

- **Status**: TODO
- **Commit**: 90a50e7
- **Severity**: MEDIUM
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan（async success / failure mis-signal）
- **Estimated scope**: 1–2 files, 小〜中

## Problem

`src/components/admin-form.tsx:153-167` で `action` 成功後に `refresh()` や `onSaved` が例外を投げると、同じ `catch` で `FAILURE_MESSAGE`（保存失敗）になる。実データは保存済みなのに UI は失敗表示し、`onSaved` が飛んでフォームがクリアされないことがある。

```ts
// src/components/admin-form.tsx:153-167 — current
try {
  const result = await action(input)
  resultFailure = actionResultFailure(result, getResultFailure)
  if (resultFailure) {
    setFailure(resultFailure)
    await refresh()
    return
  }

  await refresh()
  onSaved?.()
} catch {
  if (!resultFailure) setFailure(FAILURE_MESSAGE)
} finally {
  setSubmitting(false)
}
```

`useAdminAction`（:192-202）も `action` と `refresh` が同じ try に入っている。

## Target

保存（または業務エラー付き結果）と、その後の refresh / onSaved を分離する。

```ts
// useAdminForm.submit — target
setSubmitting(true)
let resultFailure: string | null = null
try {
  const result = await action(input)
  resultFailure = actionResultFailure(result, getResultFailure)
  if (resultFailure) {
    setFailure(resultFailure)
    try {
      await refresh()
    } catch {
      // 業務エラー表示を優先。refresh 失敗で上書きしない
    }
    return
  }
} catch {
  setFailure(FAILURE_MESSAGE)
  return
} finally {
  setSubmitting(false)
}

try {
  await refresh()
} catch {
  // 保存は成功している。一覧再取得だけ失敗しても保存失敗扱いにしない
}
onSaved?.()
```

```ts
// useAdminAction.run — target
setFailure(null)
setRunning(true)
try {
  await action()
} catch {
  setFailure(FAILURE_MESSAGE)
  return
} finally {
  setRunning(false)
}

try {
  await refresh()
} catch {
  // 操作は成功。refresh 失敗で失敗メッセージを出さない
}
```

`setSubmitting(false)` / `setRunning(false)` のタイミングは「サーバ操作が終わった時点」に寄せる（refresh 待ちでボタンが長く disabled のままでも可だが、現状の finally 位置と大きくずらさないこと）。上の案では action 完了後に submitting を下ろしてから refresh する。

## Repo conventions to follow

- `FAILURE_MESSAGE` 定数と `forgetConcerts` + `router.invalidate` の refresh は維持
- テストは現状 `actionResultFailure` 単位（`admin-form.test.ts`）。フックの挙動を足すなら同ファイルか専用テスト。無理に RTL を増やさない

## Steps

1. `useAdminForm` の try/catch を上記どおり分割する
2. `useAdminAction` も同様に分割する
3. 可能なら「action 成功・refresh 失敗でも FAILURE_MESSAGE を立てない」単体テストを追加する（モックが重い場合はスキップ可だが、その場合は手動確認を必須にする）
4. 文言・公開 API は変えない

## Boundaries

- Do NOT 新しい依存やトースト基盤を足す
- Do NOT 各管理画面のフォーム呼び出し側を広範囲に触る
- Do NOT `settings.tsx` / `login.tsx` / bulk の独自 submit をこの計画で直す（別計画・別スコープ）
- STOP if `useAdminForm` の契約が stamp から変わっていたら報告する

## Verification

- **Mechanical**: `pnpm lint` / `pnpm typecheck` / `pnpm test`
- **Behavior check**: 管理の曲・お知らせ等で通常保存が成功しフォームがクリア／閉じること。意図的に refresh を壊せない場合はコードレビューで分岐を追跡し、保存成功パスが `setFailure(FAILURE_MESSAGE)` に入らないことを確認
- **Done when**: 保存成功後の refresh 例外が保存失敗 UI に化けない
