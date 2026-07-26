import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'

// Sec-Fetch-Site か Origin が自サイトと一致しないサーバ関数呼び出しを 403 で落とす。
// Start は start.ts が無ければ同等のものを既定で入れるが、ここで requestMiddleware を
// 指定すると既定が外れるため、明示的に並べておく必要がある
const csrf = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === 'serverFn',
})

const securityHeaders = createMiddleware({ type: 'request' }).server(
  async ({ next }) => {
    const result = await next()
    const response = new Response(result.response.body, {
      status: result.response.status,
      statusText: result.response.statusText,
      headers: result.response.headers,
    })
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    return { ...result, response }
  },
)

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders, csrf],
}))
