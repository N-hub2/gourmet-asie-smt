import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { createApp, createRouter, toNodeListener } from 'h3'
import { createServer } from 'node:http'
import { eq, sql } from 'drizzle-orm'
import * as schema from '../server/database/schema'
import { hashPassword, tokenHash } from '../server/auth/password'
const state = vi.hoisted(() => ({ db: null as unknown, access: vi.fn() }))
vi.mock('../server/database/client', () => ({ getDb: () => { state.access(); return state.db } }))
import login from '../server/api/auth/login.post'
import me from '../server/api/auth/me.get'
import logout from '../server/api/auth/logout.post'
import management from '../server/api/management/[resource]'
import createStaff from '../server/api/management/staff.post'
import security from '../server/middleware/security'
const pg = new PGlite()
const db = drizzle(pg, { schema })
state.db = db
const app = createApp().use(security)
const router = createRouter().post('/api/auth/login', login).get('/api/auth/me', me).post('/api/auth/logout', logout)
router.post('/api/management/staff', createStaff)
router.use('/api/management/:resource', management)
app.use(router)
const server = createServer(toNodeListener(app))
let baseURL: string
const secret = 'mot-de-passe-reserve-aux-tests'
async function request(path: string, method = 'GET', body?: unknown, cookie = '', origin = 'http://localhost:3000') {
  return fetch(`${baseURL}${path}`, { method, headers: { origin, 'content-type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body) })
}
async function signIn(email: string) {
  const response = await request('/api/auth/login', 'POST', { email, password: secret })
  expect(response.status).toBe(200)
  return response.headers.get('set-cookie')!.split(';')[0]!
}
beforeAll(async () => {
  process.env.APP_ORIGIN = 'http://localhost:3000'
  await migrate(db, { migrationsFolder: './drizzle' })
  await migrate(db, { migrationsFolder: './drizzle' })
  const passwordHash = await hashPassword(secret)
  await db.insert(schema.users).values([{ email: 'admin@example.test', passwordHash, role: 'ADMIN' }, { email: 'waiter@example.test', passwordHash, role: 'WAITER' }])
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server unavailable')
  baseURL = `http://127.0.0.1:${address.port}`
})
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await pg.close() })
describe('API et base PostgreSQL embarquée', () => {
  it.each(['ADMIN', 'WAITER'])('connecte explicitement le rôle %s sans exposer son secret', async role => {
    const email = role === 'ADMIN' ? 'admin@example.test' : 'waiter@example.test'
    const response = await request('/api/auth/login', 'POST', { email, password: secret })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: expect.any(String), email, role })
  })
  it('applique la migration et permet son rejeu sans modifier les comptes', async () => {
    await migrate(db, { migrationsFolder: './drizzle' })
    expect(await db.select().from(schema.users)).toHaveLength(2)
    const result = await pg.query<{ count: number }>("select count(*)::int as count from information_schema.tables where table_schema='public'")
    expect(result.rows[0]?.count).toBe(12)
  })
  it('refuse les accès anonymes avant tout accès de gestion', async () => {
    expect((await request('/api/management/categories')).status).toBe(401)
    expect((await request('/api/management/products', 'POST', {})).status).toBe(401)
  })
  it.each(['categories', 'products', 'variants', 'tables', 'staff'])('refuse les écritures WAITER sur %s', async resource => {
    const cookie = await signIn('waiter@example.test')
    for (const method of ['POST', 'PUT', 'DELETE']) {
      expect((await request(`/api/management/${resource}`, method, {}, cookie)).status).toBe(403)
    }
  })
  it('rejette les corps invalides avant accès à la base', async () => {
    state.access.mockClear()
    const response = await fetch(`${baseURL}/api/auth/login`, { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: '{invalid' })
    expect(response.status).toBe(400)
    expect(state.access).not.toHaveBeenCalled()
    expect((await request('/api/auth/login', 'POST', { email: 'invalid', password: '' })).status).toBe(400)
    expect(state.access).not.toHaveBeenCalled()
    expect((await request('/api/auth/login', 'POST')).status).toBe(400)
    expect((await request('/api/auth/logout', 'POST')).status).toBe(200)
    expect(state.access).not.toHaveBeenCalled()
  })
  it('rejette une grande requête avant toute lecture ou écriture en base', async () => {
    state.access.mockClear()
    for (let attempt = 0; attempt < 8; attempt++) {
      expect((await request('/api/auth/login', 'POST', { email: 'admin@example.test', password: 'x'.repeat(20000) })).status).toBe(413)
    }
    expect(state.access).not.toHaveBeenCalled()
  })
  it.each(['/auth/login', '/auth/logout', '/management/categories', '/management/products', '/management/variants', '/management/tables', '/management/staff'])('rejette le flux Chunked trop grand avant accès à la base : %s', async path => {
    state.access.mockClear()
    const chunks = [new TextEncoder().encode('{"value":"'), new Uint8Array(8192).fill(120), new Uint8Array(8192).fill(120), new TextEncoder().encode('"}')]
    const body = new ReadableStream<Uint8Array>({ pull(controller) { const chunk = chunks.shift(); if (chunk) controller.enqueue(chunk); else controller.close() } })
    const response = await fetch(`${baseURL}/api${path}`, { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body, duplex: 'half' } as RequestInit)
    expect(response.status).toBe(413)
    expect(state.access).not.toHaveBeenCalled()
  })
  it('vérifie les cookies, les rôles et la révocation', async () => {
    const response = await request('/api/auth/login', 'POST', { email: 'waiter@example.test', password: secret })
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).toContain('SameSite=Strict')
    const cookie = response.headers.get('set-cookie')!.split(';')[0]!
    expect((await request('/api/auth/me', 'GET', undefined, cookie)).status).toBe(200)
    expect((await request('/api/management/tables', 'POST', { name: 'Test', capacity: 2 }, cookie)).status).toBe(403)
    expect((await request('/api/management/tables', 'GET', undefined, cookie)).status).toBe(200)
    await request('/api/auth/logout', 'POST', {}, cookie)
    expect((await request('/api/auth/me', 'GET', undefined, cookie)).status).toBe(401)
  })
  it('refuse les secrets incorrects, sessions expirées et comptes désactivés', async () => {
    expect((await request('/api/auth/login', 'POST', { email: 'admin@example.test', password: 'incorrect' })).status).toBe(401)
    const cookie = await signIn('waiter@example.test')
    await db.update(schema.sessions).set({ expiresAt: new Date(0) }).where(eq(schema.sessions.tokenHash, tokenHash(cookie.split('=')[1]!)))
    expect((await request('/api/auth/me', 'GET', undefined, cookie)).status).toBe(401)
    const other = await signIn('waiter@example.test')
    await db.update(schema.users).set({ active: false }).where(eq(schema.users.email, 'waiter@example.test'))
    expect((await request('/api/auth/me', 'GET', undefined, other)).status).toBe(401)
  })
  it('CRUD administrateur, validation, origine et journal transactionnel', async () => {
    const cookie = await signIn('admin@example.test')
    expect((await request('/api/management/categories', 'POST', { name: 'Test' }, cookie, 'http://evil.test')).status).toBe(403)
    expect((await request('/api/management/categories', 'POST', { name: '' }, cookie)).status).toBe(400)
    const category = await (await request('/api/management/categories', 'POST', { name: 'Catégorie test' }, cookie)).json()
    const product = await (await request('/api/management/products', 'POST', { name: 'Produit test', categoryId: category.id }, cookie)).json()
    expect((await request('/api/management/variants', 'POST', { name: 'Variante test', productId: product.id, priceCents: 123 }, cookie)).status).toBe(200)
    expect((await request('/api/management/tables', 'POST', { name: 'Table test', capacity: 4 }, cookie)).status).toBe(200)
    expect((await request(`/api/management/categories?id=${category.id}`, 'DELETE', {}, cookie)).status).toBe(409)
    expect((await request(`/api/management/products?id=${product.id}`, 'PUT', { name: 'Renommé', categoryId: category.id, active: false }, cookie)).status).toBe(200)
    const temporary = await (await request('/api/management/categories', 'POST', { name: 'Temporaire' }, cookie)).json()
    expect((await request(`/api/management/categories?id=${temporary.id}`, 'DELETE', undefined, cookie)).status).toBe(200)
    expect((await db.select().from(schema.auditLogs)).length).toBe(7)
  })
  it('contraintes SQL et conservation des prix historiques', async () => {
    const [product] = await db.select().from(schema.products)
    const [variant] = await db.select().from(schema.productVariants)
    const [table] = await db.select().from(schema.restaurantTables)
    const [user] = await db.select().from(schema.users)
    const [visit] = await db.insert(schema.tableVisits).values({ tableId: table!.id, openedBy: user!.id }).returning()
    await expect(db.insert(schema.tableVisits).values({ tableId: table!.id, openedBy: user!.id })).rejects.toThrow()
    const [order] = await db.insert(schema.orders).values({ visitId: visit!.id, createdBy: user!.id }).returning()
    await db.insert(schema.orderItems).values({ orderId: order!.id, productId: product!.id, variantId: variant!.id, productName: product!.name, variantName: variant!.name, unitPriceCents: 123, quantity: 2 })
    await db.update(schema.productVariants).set({ priceCents: 456 }).where(eq(schema.productVariants.id, variant!.id))
    expect((await db.select().from(schema.orderItems))[0]!.unitPriceCents).toBe(123)
    await expect(db.update(schema.productVariants).set({ priceCents: -1 })).rejects.toThrow()
    await expect(db.delete(schema.products).where(eq(schema.products.id, product!.id))).rejects.toThrow()
  })
  it('annule la mutation de gestion si son audit ne peut pas être enregistré', async () => {
    const cookie = await signIn('admin@example.test')
    const before = await db.select().from(schema.categories)
    const logs = await db.select().from(schema.auditLogs)
    await db.execute(sql`alter table audit_logs add constraint reject_review_post check (action <> 'POST') not valid`)
    try {
      expect((await request('/api/management/categories', 'POST', { name: 'Rollback audit probe' }, cookie)).status).toBe(409)
      expect(await db.select().from(schema.categories)).toEqual(before)
      expect(await db.select().from(schema.auditLogs)).toEqual(logs)
    } finally { await db.execute(sql`alter table audit_logs drop constraint reject_review_post`) }
  })
  it('crée un serveur sans exposer son secret et permet sa connexion', async () => {
    const cookie = await signIn('admin@example.test')
    const response = await request('/api/management/staff', 'POST', { email: 'new@example.test', displayName: 'Test', password: secret, role: 'WAITER' }, cookie)
    expect(response.status).toBe(200)
    const user = await response.json()
    expect(user.passwordHash).toBeUndefined()
    expect(user.password).toBeUndefined()
    const waiter = await signIn('new@example.test')
    expect((await request('/api/management/staff', 'POST', {}, waiter)).status).toBe(403)
    expect((await request('/api/management/products', 'DELETE', {}, waiter)).status).toBe(403)
  })
  it('émet un cookie Secure en production et limite les tentatives', async () => {
    const previous = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const response = await request('/api/auth/login', 'POST', { email: 'admin@example.test', password: secret })
      expect(response.headers.get('set-cookie')).toContain('Secure')
    } finally { process.env.NODE_ENV = previous }
    for (let i = 0; i < 10; i++) await request('/api/auth/login', 'POST', { email: 'absent@example.test', password: 'incorrect' })
    expect((await request('/api/auth/login', 'POST', { email: 'absent@example.test', password: 'incorrect' })).status).toBe(429)
  })
})
