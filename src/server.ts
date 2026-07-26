import handler from '@tanstack/react-start/server-entry'

export default {
  fetch: handler.fetch,

  // リンク切れ検知と掃除処理は Phase 5 でここに実装する
  scheduled(event) {
    console.log('scheduled handler invoked', { cron: event.cron })
  },
} satisfies ExportedHandler<Env>
