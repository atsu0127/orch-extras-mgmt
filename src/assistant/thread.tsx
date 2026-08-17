import {
  Alert,
  Button,
  Group,
  Loader,
  Stack,
  Text,
  Textarea,
  UnstyledButton,
} from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { ConfirmButton } from '../components/confirm-button'
import {
  ASK_ASSISTANT_ERROR_MESSAGES,
  ASSISTANT_LIMITS,
  ASSISTANT_PRIVACY_NOTICE,
  SUGGESTED_QUESTIONS,
} from '../lib/assistant'
import { formatAssistantDateTime } from './format'
import { askAssistant } from './functions'
import { AssistantSourceLinks } from './source-links'
import {
  clearAssistantConversations,
  closeAssistantPanel,
  sendAssistantQuestion,
  startAssistantConversation,
  useAssistantStore,
} from './store'

export function AssistantThread({
  selectedConcertId,
  showPageLink,
}: {
  selectedConcertId: number | null
  showPageLink: boolean
}) {
  const store = useAssistantStore()
  const ask = useServerFn(askAssistant)
  const [draft, setDraft] = useState('')
  const active = store.conversations.find(
    (conversation) => conversation.id === store.activeId,
  )
  const lastUser = [...(active?.messages ?? [])]
    .reverse()
    .find((message) => message.role === 'user')

  async function submit(question: string, retry = false) {
    if (selectedConcertId === null) return
    setDraft('')
    await sendAssistantQuestion({
      question,
      selectedConcertId,
      ask,
      ...(retry ? { retry: true } : {}),
    })
  }

  return (
    <div className="assistant-thread">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Text size="sm" fw={700}>
            {active?.title ?? 'AI案内'}
          </Text>
          {showPageLink && (
            <Button
              component={Link}
              to="/assistant"
              variant="subtle"
              size="compact-sm"
              onClick={() => closeAssistantPanel()}
            >
              専用ページで開く
            </Button>
          )}
        </Group>
        <Text size="xs" c="dimmed">
          {ASSISTANT_PRIVACY_NOTICE}
        </Text>
      </Stack>

      <div className="assistant-messages" aria-live="polite">
        {!active || active.messages.length === 0 ? (
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              候補の質問を選ぶか、自由に入力できます。
            </Text>
            <Group gap="xs">
              {SUGGESTED_QUESTIONS.map((question) => (
                <UnstyledButton
                  key={question}
                  type="button"
                  className="assistant-suggestion"
                  disabled={store.sending || selectedConcertId === null}
                  onClick={() => {
                    void submit(question)
                  }}
                >
                  {question}
                </UnstyledButton>
              ))}
            </Group>
          </Stack>
        ) : (
          active.messages.map((message) =>
            message.role === 'user' ? (
              <div
                key={message.id}
                className="assistant-bubble assistant-bubble--user"
              >
                <Text size="sm">{message.content}</Text>
              </div>
            ) : (
              <div
                key={message.id}
                className="assistant-bubble assistant-bubble--assistant"
              >
                <Group gap="xs" mb={4}>
                  {message.concertName && (
                    <Text size="xs" c="dimmed">
                      {message.concertName}
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    {formatAssistantDateTime(message.createdAt)}
                  </Text>
                </Group>
                <Text size="sm" className="detail">
                  {message.content}
                </Text>
                <AssistantSourceLinks links={message.links} />
              </div>
            ),
          )
        )}
        {store.sending && (
          <Group
            gap="xs"
            className="assistant-bubble assistant-bubble--assistant"
          >
            <Loader size="sm" />
            <Text size="sm">登録情報を調べています…</Text>
          </Group>
        )}
      </div>

      {store.errorReason && (
        <Alert color="red" title="回答できませんでした" role="alert">
          <Stack gap="xs">
            <Text size="sm">
              {ASK_ASSISTANT_ERROR_MESSAGES[store.errorReason]}
            </Text>
            {lastUser && selectedConcertId !== null && (
              <Button
                size="compact-sm"
                onClick={() => {
                  void submit(lastUser.content, true)
                }}
              >
                もう一度試す
              </Button>
            )}
          </Stack>
        </Alert>
      )}

      <form
        className="assistant-composer"
        onSubmit={(event) => {
          event.preventDefault()
          void submit(draft)
        }}
      >
        <Textarea
          label="質問"
          name="question"
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          maxLength={ASSISTANT_LIMITS.questionMax}
          minRows={2}
          autosize
          disabled={store.sending || selectedConcertId === null}
        />
        <Group justify="space-between" mt="xs">
          <Button
            type="button"
            variant="subtle"
            size="compact-sm"
            onClick={() => {
              startAssistantConversation()
              setDraft('')
            }}
          >
            新しい会話
          </Button>
          <Button
            type="submit"
            size="compact-sm"
            disabled={
              store.sending ||
              selectedConcertId === null ||
              draft.trim().length === 0
            }
          >
            送信
          </Button>
        </Group>
      </form>
    </div>
  )
}

export function AssistantDeleteAllButton() {
  return (
    <ConfirmButton
      label="履歴を全削除"
      title="会話履歴を全削除しますか？"
      description="この端末に保存した会話をすべて消します。元に戻せません。"
      onConfirm={async () => {
        clearAssistantConversations()
      }}
    />
  )
}
