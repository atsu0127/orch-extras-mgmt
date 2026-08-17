import { Button, Drawer, Group } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { AssistantHistoryList } from '../../assistant/history-list'
import { AssistantThread } from '../../assistant/thread'
import { NoConcertState, PageSection } from '../../components/states'

export const Route = createFileRoute('/_authed/assistant')({
  component: AssistantPage,
})

function AssistantPage() {
  const { session, concert } = Route.useRouteContext()
  const isDesktop = useMediaQuery('(min-width: 48rem)') === true
  const [historyOpen, setHistoryOpen] = useState(false)
  const selectedConcertId = concert?.id ?? null

  if (!concert) return <NoConcertState role={session.role} />

  return (
    <PageSection title="AI案内" titleOrder={1}>
      <div
        className={`assistant-layout${isDesktop ? ' assistant-layout--page' : ''}`}
      >
        {isDesktop ? (
          <aside aria-label="会話履歴">
            <AssistantHistoryList />
          </aside>
        ) : (
          <>
            <Group>
              <Button
                variant="light"
                size="compact-sm"
                onClick={() => setHistoryOpen(true)}
              >
                履歴
              </Button>
            </Group>
            <Drawer
              opened={historyOpen}
              onClose={() => setHistoryOpen(false)}
              position="left"
              size="85%"
              title="会話履歴"
            >
              <AssistantHistoryList onSelect={() => setHistoryOpen(false)} />
            </Drawer>
          </>
        )}
        <AssistantThread
          selectedConcertId={selectedConcertId}
          showPageLink={false}
        />
      </div>
    </PageSection>
  )
}
