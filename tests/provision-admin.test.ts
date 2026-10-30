import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { sql } from 'drizzle-orm'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import * as schema from '../server/database/schema'
import { provisionInitialAdmin } from '../server/auth/provision-admin'
import { verifyPassword } from '../server/auth/password'

let pg: PGlite
let db: ReturnType<typeof drizzle<typeof schema>>
const input = () => ({ email: 'bootstrap@example.test', displayName: 'Responsable test', password: randomBytes(24).toString('hex'), role: 'ADMIN' })
beforeEach(async () => { pg = new PGlite(); db = drizzle(pg, { schema }); await migrate(db, { migrationsFolder: './drizzle' }) })
afterEach(async () => { await pg.close() })

describe('Provisionnement initial partagé avec le script CLI', () => {
  it('crée un administrateur, son profil et son audit sans stocker le secret en clair', async () => {
    const data = input()
    const result = await provisionInitialAdmin(db, data)
    expect(result).toEqual({ id: expect.any(String), email: data.email, role: 'ADMIN' })
    const [user] = await db.select().from(schema.users)
    expect(user!.passwordHash).not.toBe(data.password)
    expect(await verifyPassword(data.password, user!.passwordHash)).toBe(true)
    expect((await db.select().from(schema.staffProfiles))[0]?.userId).toBe(result.id)
    expect((await db.select().from(schema.auditLogs))[0]).toMatchObject({ actorId: result.id, action: 'BOOTSTRAP_ADMIN' })
  })
  it('ferme le provisionnement après le premier compte et conserve les données', async () => {
    await provisionInitialAdmin(db, input())
    await expect(provisionInitialAdmin(db, { ...input(), email: 'other@example.test' })).rejects.toThrow('fermé')
    expect(await db.select().from(schema.users)).toHaveLength(1)
    expect(await db.select().from(schema.staffProfiles)).toHaveLength(1)
    expect(await db.select().from(schema.auditLogs)).toHaveLength(1)
  })
  it('refuse un rôle non administrateur et un mot de passe trop court', async () => {
    await expect(provisionInitialAdmin(db, { ...input(), role: 'WAITER' })).rejects.toThrow()
    await expect(provisionInitialAdmin(db, { ...input(), password: 'x' })).rejects.toThrow()
    expect(await db.select().from(schema.users)).toHaveLength(0)
  })
  it('annule tout le provisionnement si le profil échoue', async () => {
    await db.execute(sql`alter table staff_profiles add constraint reject_test_profile check (display_name <> 'rollback-probe')`)
    await expect(provisionInitialAdmin(db, { ...input(), displayName: 'rollback-probe' })).rejects.toThrow()
    expect(await db.select().from(schema.users)).toHaveLength(0)
    expect(await db.select().from(schema.staffProfiles)).toHaveLength(0)
    expect(await db.select().from(schema.auditLogs)).toHaveLength(0)
  })
  it('exécute la CLI sans connexion réelle et refuse une configuration absente', () => {
    const data = input()
    const env = { ...process.env, DOTENV_CONFIG_PATH: 'tests/nonexistent-review.env' }
    delete (env as NodeJS.ProcessEnv).DATABASE_URL
    const child = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/create-admin.ts', data.email, data.displayName], { input: data.password, env, encoding: 'utf8', timeout: 10000 })
    expect(child.status).not.toBe(0)
    expect(child.stderr).toContain('DATABASE_URL requise')
    expect(`${child.stdout}${child.stderr}`).not.toContain(data.password)
  })
})
