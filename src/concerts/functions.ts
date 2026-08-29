import { createServerFn } from '@tanstack/react-start'
import { requireAuth } from '../auth/middleware'
import { getDb } from '../db/client'
import { logServerFn } from '../observability/logged-server-fn'
import { type ConcertOption, listConcertOptions } from './queries'

export const listConcerts = createServerFn({ method: 'GET' })
  .middleware([logServerFn('listConcerts'), requireAuth])
  .handler((): Promise<Array<ConcertOption>> => listConcertOptions(getDb()))
