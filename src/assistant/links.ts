const INTERNAL_PATHS = ['/', '/practices', '/pieces'] as const

export type InternalAssistantTarget = {
  to: (typeof INTERNAL_PATHS)[number]
  concert: number
}

export function parseInternalAssistantHref(
  href: string,
): InternalAssistantTarget | null {
  try {
    const url = new URL(href, 'https://oem.invalid')
    if (
      !INTERNAL_PATHS.includes(url.pathname as InternalAssistantTarget['to'])
    ) {
      return null
    }
    const concert = Number(url.searchParams.get('concert'))
    if (!Number.isInteger(concert) || concert <= 0) return null
    return {
      to: url.pathname as InternalAssistantTarget['to'],
      concert,
    }
  } catch {
    return null
  }
}
