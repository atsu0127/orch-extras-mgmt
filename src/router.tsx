import { createRouter } from '@tanstack/react-router'
import { ErrorState, PendingState } from './components/states'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    // 読み込み中とエラーの見せ方はここで一度だけ決める。画面ごとに書くと、
    // 新しい画面を足したときに付け忘れて素の表示が出てしまう
    defaultPendingComponent: PendingState,
    defaultErrorComponent: ErrorState,
  })
}
