import { defineEventHandler } from 'h3'
import { revokeSession } from '../../auth/session'
export default defineEventHandler(async event => { await revokeSession(event); return { ok: true } })
