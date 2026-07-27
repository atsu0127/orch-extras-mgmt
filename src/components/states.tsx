import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description?: string
  children?: ReactNode
}

/** データが無いときの表示。何が無いのかと、次に何をすればよいかを同じ形で見せる */
export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <div className="state">
      <p className="state-title">{title}</p>
      {description && <p>{description}</p>}
      {children}
    </div>
  )
}
