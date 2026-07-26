import { getRequest } from '@tanstack/react-start/server'

/**
 * レート制限の集計キー。`CF-Connecting-IP` は Cloudflare の edge を通った
 * リクエストには必ず付く。付かないのはローカル開発だけで、そこでは全員が
 * 同じ枠を共有しても差し支えない。
 */
export function getClientIp(): string {
  return getRequest().headers.get('cf-connecting-ip') ?? 'local'
}
