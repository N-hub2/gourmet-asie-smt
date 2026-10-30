import { randomBytes } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { createError, getCookie, setCookie, type H3Event } from 'h3'
import { getDb } from '../database/client'
import { sessions, users } from '../database/schema'
import { tokenHash } from './password'
import type { Role, StaffSession } from '../../shared/types/auth'
const cookie = 'gourmet_session'
export const canManage = (role: Role) => role === 'ADMIN'
export async function currentStaff(event: H3Event): Promise<StaffSession | null> {
  const token = getCookie(event, cookie)
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
  const [staff] = await getDb().select({ id: users.id, email: users.email, role: users.role }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date()), eq(users.active, true)))
  return staff ?? null
}
export async function requireStaff(event: H3Event, admin = false) {
  const staff = await currentStaff(event)
  if (!staff) throw createError({ statusCode: 401, message: 'Connexion requise' })
  if (admin && !canManage(staff.role)) throw createError({ statusCode: 403, message: 'Accès réservé à l’administration' })
  return staff
}
export async function createSession(event: H3Event, userId: string) {
  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000)
  await getDb().insert(sessions).values({ tokenHash: tokenHash(token), userId, expiresAt: expires })
  setCookie(event, cookie, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', expires })
}
export async function revokeSession(event: H3Event) {
  const token = getCookie(event, cookie)
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)))
  setCookie(event, cookie, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 })
}
