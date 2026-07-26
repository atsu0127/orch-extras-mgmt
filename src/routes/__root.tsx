import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      // 全ページ認証必須のため、検索エンジンには載せない
      { name: 'robots', content: 'noindex, nofollow' },
      { title: 'エキストラ情報ポータル' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  // component ではなく shellComponent に置く。SPA シェルの事前生成では
  // これだけが描画されるので、特定の画面の中身がシェルに焼き付かない
  shellComponent: RootDocument,
})

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
