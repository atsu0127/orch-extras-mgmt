import { describe, expect, it } from 'vitest'
import { Route } from './index'

describe('/admin/', () => {
  it('演奏会へリダイレクトする beforeLoad を持つ', () => {
    // 管理トップの一覧メニューを置かず、入口を演奏会に一本化するため
    expect(Route.options.beforeLoad).toEqual(expect.any(Function))
  })
})
