import { defineEventHandler, createError, getRequestIP } from 'h3'
import { getJsonBody } from '../../http/request-body'
import { eq } from 'drizzle-orm'
import { loginSchema } from '../../../shared/validation/management'
import { getDb } from '../../database/client'
import { users } from '../../database/schema'
import { hashPassword, verifyPassword } from '../../auth/password'
import { createSession } from '../../auth/session'
const attempts = new Map<string, { count: number; until: number }>()
let dummy: Promise<string> | undefined
export default defineEventHandler(async event => {
  const key = getRequestIP(event) || 'unknown'
  const now = Date.now()
  for (const [ip, entry] of attempts) if (entry.until < now) attempts.delete(ip)
  const entry = attempts.get(key) ?? { count: 0, until: now + 15 * 60 * 1000 }
  if (entry.count >= 10 || attempts.size > 10000) throw createError({ statusCode: 429, message: 'Trop de tentatives. Réessayez plus tard.' })
  entry.count++; attempts.set(key, entry)
  const parsed = loginSchema.safeParse(getJsonBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Données invalides' })
  const input = parsed.data
  const [user] = await getDb().select().from(users).where(eq(users.email, input.email))
  const valid = await verifyPassword(input.password, user?.passwordHash ?? await (dummy ??= hashPassword('dummy-verification-value')))
  if (!user?.active || !valid) throw createError({ statusCode: 401, message: 'Identifiants incorrects' })
  await createSession(event, user.id)
  attempts.delete(key)
  return { id: user.id, email: user.email, role: user.role }
})
