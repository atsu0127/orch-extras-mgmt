import { describe, expect, it } from 'vitest'
import { Route } from './assistant'

describe('/assistant', () => {
  it('extra をホームへ戻す beforeLoad を持つ', () => {
    expect(Route.options.beforeLoad).toEqual(expect.any(Function))
  })
})
