import { Button, Stack, Text, UnstyledButton } from '@mantine/core'
import { ConfirmButton } from '../components/confirm-button'
import { formatAssistantDateTime } from './format'
import {
  deleteAssistantConversation,
  selectAssistantConversation,
  startAssistantConversation,
  useAssistantStore,
} from './store'
import { AssistantDeleteAllButton } from './thread'

export function AssistantHistoryList({ onSelect }: { onSelect?: () => void }) {
  const store = useAssistantStore()

  return (
    <Stack gap="sm" className="assistant-history">
      <Button
        size="compact-sm"
        onClick={() => {
          startAssistantConversation()
          onSelect?.()
        }}
      >
        新しい会話
      </Button>
      {store.conversations.length === 0 ? (
        <Text size="sm" c="dimmed">
          まだ会話はありません。
        </Text>
      ) : (
        <ul className="assistant-history-list">
          {store.conversations.map((conversation) => (
            <li key={conversation.id}>
              <UnstyledButton
                className="assistant-history-item"
                data-active={
                  conversation.id === store.activeId ? 'true' : 'false'
                }
                onClick={() => {
                  selectAssistantConversation(conversation.id)
                  onSelect?.()
                }}
              >
                <Text size="sm" fw={600} lineClamp={2}>
                  {conversation.title}
                </Text>
                <Text size="xs" c="dimmed">
                  {conversation.concertName ?? '演奏会未設定'}
                  {' · '}
                  {formatAssistantDateTime(conversation.updatedAt)}
                </Text>
              </UnstyledButton>
              <ConfirmButton
                label="削除"
                labelAriaLabel={`${conversation.title}を削除`}
                title="この会話を削除しますか？"
                description="この端末からこの会話だけを消します。"
                onConfirm={async () => {
                  deleteAssistantConversation(conversation.id)
                }}
              />
            </li>
          ))}
        </ul>
      )}
      {store.conversations.length > 0 && <AssistantDeleteAllButton />}
    </Stack>
  )
}
