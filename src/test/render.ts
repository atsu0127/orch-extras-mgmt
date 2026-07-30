import { MantineProvider } from '@mantine/core'
import { createElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { theme } from '../theme'

/** コンポーネント単体テスト用。Mantine は Provider 無しだと描画できない */
export function renderMarkup(node: ReactNode): string {
  return renderToStaticMarkup(
    createElement(MantineProvider, { theme, env: 'test' }, node),
  )
}

export function element(
  type: Parameters<typeof createElement>[0],
  props: Record<string, unknown>,
): ReactElement {
  return createElement(type, props)
}
