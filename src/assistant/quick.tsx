import { Affix, Button, Drawer } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconSparkles } from '@tabler/icons-react'
import { useRouterState } from '@tanstack/react-router'
import {
  closeAssistantPanel,
  openAssistantPanel,
  useAssistantStore,
} from './store'
import { AssistantThread } from './thread'

export function AssistantQuick({
  selectedConcertId,
}: {
  selectedConcertId: number | null
}) {
  const store = useAssistantStore()
  const isDesktop = useMediaQuery('(min-width: 48rem)') === true
  const pathname = useRouterState({
    select: (routerState) => routerState.location.pathname,
  })
  const hideEntry = pathname === '/assistant' || pathname.startsWith('/admin')

  return (
    <>
      {!hideEntry && (
        <Affix position={{ bottom: isDesktop ? 24 : 88, right: 16 }}>
          <Button
            leftSection={<IconSparkles size={18} aria-hidden />}
            onClick={() => openAssistantPanel()}
          >
            AIに聞く
          </Button>
        </Affix>
      )}
      <Drawer
        opened={store.panelOpen}
        onClose={() => closeAssistantPanel()}
        position={isDesktop ? 'right' : 'bottom'}
        size={isDesktop ? '28rem' : '85%'}
        title="AI案内"
        overlayProps={{ backgroundOpacity: 0.35 }}
      >
        <div data-assistant-placement={isDesktop ? 'right' : 'bottom'}>
          <AssistantThread selectedConcertId={selectedConcertId} showPageLink />
        </div>
      </Drawer>
    </>
  )
}
