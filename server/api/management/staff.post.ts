import { defineEventHandler, createError } from 'h3'
import { getJsonBody } from '../../http/request-body'
import { requireStaff } from '../../auth/session'
import { getDb } from '../../database/client'
import { users, staffProfiles, auditLogs } from '../../database/schema'
import { hashPassword } from '../../auth/password'
import { staffSchema } from '../../../shared/validation/management'
export default defineEventHandler(async event => {
  const actor = await requireStaff(event, true)
  const parsed = staffSchema.safeParse(getJsonBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Données invalides' })
  const { password, displayName, ...input } = parsed.data
  const passwordHash = await hashPassword(password)
  try { return await getDb().transaction(async tx => {
    const [user] = await tx.insert(users).values({ ...input, passwordHash }).returning({ id: users.id, email: users.email, role: users.role })
    if (!user) throw createError({ statusCode: 500 })
    await tx.insert(staffProfiles).values({ userId: user.id, displayName })
    await tx.insert(auditLogs).values({ actorId: actor.id, action: 'CREATE_STAFF', entityType: 'users', entityId: user.id })
    return user
  }) } catch (error) {
    const failure = error as { code?: string; cause?: { code?: string } }
    if ((failure.code ?? failure.cause?.code) === '23505') throw createError({ statusCode: 409, message: 'Cette adresse e-mail est déjà utilisée' })
    throw error
  }
})
