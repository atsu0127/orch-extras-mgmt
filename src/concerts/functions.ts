import { createServerFn } from '@tanstack/react-start'
import { requireAuth } from '../auth/middleware'
import { getDb } from '../db/client'
import { type ConcertOption, listConcertOptions } from './queries'

export const listConcerts = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler((): Promise<Array<ConcertOption>> => listConcertOptions(getDb()))
