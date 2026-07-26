import handler from '@tanstack/react-start/server-entry'

export default {
  // Workers が渡す env を Start のオプション引数と誤認させないため、
  // handler.fetch を直接公開せず request のみを渡す
  fetch(request) {
    return handler.fetch(request)
  },

  // リンク切れ検知と掃除処理は Phase 5 でここに実装する
  scheduled(event) {
    console.log('scheduled handler invoked', { cron: event.cron })
  },
} satisfies ExportedHandler<Env>
