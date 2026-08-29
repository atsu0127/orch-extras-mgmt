import { requireAuth } from '../auth/middleware'
import { getDb } from '../db/client'
import { loggedServerFn } from '../observability/logged-server-fn'
import { type ConcertOption, listConcertOptions } from './queries'

export const listConcerts = loggedServerFn('listConcerts', { method: 'GET' })
  .middleware([requireAuth])
  .handler((): Promise<Array<ConcertOption>> => listConcertOptions(getDb()))
