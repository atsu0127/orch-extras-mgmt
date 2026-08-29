import { Badge, Group, Stack, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { ExternalLink } from '../components/external-link'
import type { SourceLink } from '../lib/assistant'
import { parseInternalAssistantHref } from './links'

export function AssistantSourceLinks({
  links,
}: {
  links: ReadonlyArray<SourceLink>
}) {
  if (links.length === 0) return null

  return (
    <Stack gap={6} mt={6}>
      <Text size="xs" c="dimmed">
        根拠
      </Text>
      <Group gap="xs">
        {links.map((link) => (
          <AssistantSourceLink key={link.key} link={link} />
        ))}
      </Group>
    </Stack>
  )
}

function AssistantSourceLink({ link }: { link: SourceLink }) {
  if (link.external) {
    return <ExternalLink href={link.href}>{link.label}</ExternalLink>
  }

  const target = parseInternalAssistantHref(link.href)
  if (!target) return <Badge variant="light">{link.label}</Badge>

  if (target.to === '/practices') {
    return (
      <Link
        to="/practices"
        search={{ concert: target.concert }}
        className="assistant-internal-link"
      >
        {link.label}
      </Link>
    )
  }
  if (target.to === '/pieces') {
    return (
      <Link
        to="/pieces"
        search={{ concert: target.concert }}
        className="assistant-internal-link"
      >
        {link.label}
      </Link>
    )
  }
  return (
    <Link
      to="/"
      search={{ concert: target.concert }}
      className="assistant-internal-link"
    >
      {link.label}
    </Link>
  )
}
