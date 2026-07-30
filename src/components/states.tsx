import { Alert, Anchor, Button, Stack, Text, Title } from '@mantine/core'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { Link, useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { Role } from '../lib/roles'

type EmptyStateProps = {
  title: string
  description?: string
  children?: ReactNode
}

/** データが無いときの表示。何が無いのかと、次に何をすればよいかを同じ形で見せる */
export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <Alert
      variant="light"
      color="ink"
      radius="md"
      title={title}
      // アイコン列があると親の text-align:center と組み合わさり左右で揃いが崩れる
      icon={null}
      className="empty-state"
    >
      <Stack gap="xs">
        {description && <Text size="sm">{description}</Text>}
        {children}
      </Stack>
    </Alert>
  )
}

/**
 * 演奏会が1件も無いときの表示（設計書7.1）。演奏会を選ばないと成り立たない画面が
 * それぞれ出す。管理者には作成への導線を見せる。
 */
export function NoConcertState({ role }: { role: Role }) {
  return (
    <EmptyState title="まだ公開された演奏会がありません">
      {role === 'admin' ? (
        <Text size="sm">
          <Anchor component={Link} to="/admin/concerts">
            管理画面
          </Anchor>
          から演奏会を登録してください。
        </Text>
      ) : (
        <Text size="sm">管理者が登録するまでお待ちください。</Text>
      )}
    </EmptyState>
  )
}

/** ルータの `defaultPendingComponent`。loader の待ち時間が長いときだけ出る */
export function PendingState() {
  return (
    <output aria-live="polite">
      <Text c="dimmed">読み込み中です…</Text>
    </output>
  )
}

/**
 * ルータの `defaultErrorComponent`。
 *
 * 例外の中身は出さない。サーバ関数の失敗理由には D1 のエラー文言などが混ざり、
 * 読む人の役に立たないうえに内部の構造を漏らす。
 */
export function ErrorState({ reset }: ErrorComponentProps) {
  const router = useRouter()

  return (
    <Alert
      variant="light"
      color="red"
      radius="md"
      title="表示できませんでした"
      role="alert"
    >
      <Stack gap="sm">
        <Text size="sm">
          通信が不安定なときに起こります。時間をおいてやり直してください。
        </Text>
        <Button
          variant="light"
          onClick={() => {
            reset()
            void router.invalidate()
          }}
        >
          やり直す
        </Button>
      </Stack>
    </Alert>
  )
}

type PageSectionProps = {
  title?: string
  titleOrder?: 1 | 2 | 3
  children: ReactNode
}

export function PageSection({
  title,
  titleOrder = 2,
  children,
}: PageSectionProps) {
  return (
    <Stack gap="sm" component="section">
      {title && <Title order={titleOrder}>{title}</Title>}
      {children}
    </Stack>
  )
}
