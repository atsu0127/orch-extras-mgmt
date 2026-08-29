import { describe, expect, it } from 'vitest'
import { getRouter } from './router'

describe('getRouter', () => {
  it('生成されたルートツリーを読み込める', () => {
    const router = getRouter()

    expect(Object.keys(router.routesById)).toEqual(
      expect.arrayContaining([
        '/login',
        '/_authed/',
        '/_authed/admin/',
        '/_authed/assistant',
      ]),
    )
  })
})
