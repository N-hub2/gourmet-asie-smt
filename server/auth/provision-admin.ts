import { sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from '../database/schema'
import { staffSchema } from '../../shared/validation/management'
import { hashPassword } from './password'

export async function provisionInitialAdmin<T extends PgQueryResultHKT>(db: PgDatabase<T, typeof schema>, input: unknown) {
  const parsed = staffSchema.parse(input)
  if (parsed.role !== 'ADMIN') throw new Error('Le compte initial doit être administrateur.')
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(847210)`)
    const existing = await tx.select({ id: schema.users.id }).from(schema.users).limit(1)
    if (existing.length) throw new Error('Provisionnement initial fermé : un compte existe déjà.')
    const [user] = await tx.insert(schema.users).values({ email: parsed.email, role: 'ADMIN', passwordHash: await hashPassword(parsed.password) }).returning({ id: schema.users.id, email: schema.users.email, role: schema.users.role })
    if (!user) throw new Error('Création impossible')
    await tx.insert(schema.staffProfiles).values({ userId: user.id, displayName: parsed.displayName })
    await tx.insert(schema.auditLogs).values({ actorId: user.id, action: 'BOOTSTRAP_ADMIN', entityType: 'users', entityId: user.id })
    return user
  })
}
