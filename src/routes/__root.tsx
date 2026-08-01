import {
  ColorSchemeScript,
  MantineProvider,
  mantineHtmlProps,
} from '@mantine/core'
import mantineCss from '@mantine/core/styles.css?url'
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import appCss from '../styles.css?url'
import { theme } from '../theme'

const FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&family=Noto+Serif+JP:wght@600&display=swap'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      // 全ページ認証必須のため、検索エンジンには載せない
      { name: 'robots', content: 'noindex, nofollow' },
      { title: 'エキストラ情報ポータル' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      { rel: 'stylesheet', href: FONT_CSS },
      { rel: 'stylesheet', href: mantineCss },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  // component ではなく shellComponent に置く。SPA シェルの事前生成では
  // これだけが描画されるので、特定の画面の中身がシェルに焼き付かない
  shellComponent: RootDocument,
  component: RootComponent,
})

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja" {...mantineHtmlProps}>
      <head>
        <HeadContent />
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <div className="app-shell">
        <Outlet />
      </div>
    </MantineProvider>
  )
}
