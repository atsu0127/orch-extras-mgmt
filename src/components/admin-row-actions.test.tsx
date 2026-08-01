import { describe, expect, it, vi } from 'vitest'
import { renderMarkup } from '../test/render'
import { AdminManagedLinkRow, AdminRowActions } from './admin-row-actions'

describe('AdminRowActions', () => {
  it('並べ替えは aria-label 付きアイコン、編集・削除はラベルを出す', () => {
    const html = renderMarkup(
      <AdminRowActions
        moveUpLabel="「資料A」を上へ"
        moveDownLabel="「資料A」を下へ"
        canMoveUp
        canMoveDown
        onMoveUp={() => undefined}
        onMoveDown={() => undefined}
        onEdit={() => undefined}
        editAriaLabel="「資料A」を編集"
        deleteTitle="「資料A」を削除しますか？"
        deleteAriaLabel="「資料A」を削除"
        onDelete={() => Promise.resolve()}
      />,
    )

    expect(html).toContain('aria-label="「資料A」を上へ"')
    expect(html).toContain('aria-label="「資料A」を下へ"')
    expect(html).toContain('aria-label="「資料A」を編集"')
    expect(html).toContain('aria-label="「資料A」を削除"')
    expect(html).toContain('編集')
    expect(html).toContain('削除')
    expect(html).toContain('aria-labelledby=')
    expect(html).not.toContain('>↑<')
    expect(html).not.toContain('>↓<')
  })

  it('編集や並べ替えが無いときは出さない', () => {
    const html = renderMarkup(
      <AdminRowActions
        moveUpLabel="上へ"
        moveDownLabel="下へ"
        deleteTitle="消しますか？"
        onDelete={() => Promise.resolve()}
      />,
    )

    expect(html).not.toContain('編集')
    expect(html).not.toContain('aria-label="上へ"')
    expect(html).toContain('削除')
  })

  it('AdminManagedLinkRow はリンクと操作を並べる', () => {
    const html = renderMarkup(
      <AdminManagedLinkRow
        link={<a href="https://example.com">資料</a>}
        actions={<button type="button">編集</button>}
      />,
    )

    expect(html).toContain('admin-managed-link-row')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('編集')
  })

  it('失敗メッセージを出せる', () => {
    const onDelete = vi.fn(() => Promise.resolve())
    const html = renderMarkup(
      <AdminRowActions
        failure="並び替えに失敗しました"
        moveUpLabel="上へ"
        moveDownLabel="下へ"
        onMoveUp={() => undefined}
        onMoveDown={() => undefined}
        canMoveUp
        canMoveDown
        deleteTitle="消しますか？"
        onDelete={onDelete}
      />,
    )

    expect(html).toContain('並び替えに失敗しました')
  })
})
