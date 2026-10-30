import { test, expect, type BrowserContext } from '@playwright/test'
import postgres from 'postgres'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { hashPassword } from '../../server/auth/password'

test.describe.configure({ mode: 'serial' })
const run = randomBytes(6).toString('hex')
const admin = { email: `admin-${run}@example.test`, password: randomBytes(32).toString('hex') }
const waiter = { email: `waiter-${run}@example.test`, password: randomBytes(32).toString('hex') }
const origin = 'http://127.0.0.1:3200'
let owner: ReturnType<typeof postgres>, runtime: ReturnType<typeof postgres>
let adminContext: BrowserContext, waiterContext: BrowserContext
let categoryId: string, productId: string, variantId: string
const priorRows: Array<{ table: string; key: string; rows: Array<Record<string, unknown>> }> = []
async function structure() {
  return JSON.stringify(await owner`select c.relname,a.attname,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid where n.nspname='public' and c.relkind='r' and a.attnum>0 order by c.relname,a.attnum`)
}
test.beforeAll(async ({ browser }) => {
  for (const value of [process.env.PG_RUNTIME_URL, process.env.PG_MIGRATION_URL]) {
    if (!value || new URL(value).hostname !== '127.0.0.1' || new URL(value).pathname !== '/gourmet_asie_dev') throw new Error('Only the approved development database is allowed')
  }
  owner = postgres(process.env.PG_MIGRATION_URL!, { max: 1, onnotice: () => {} })
  // Drizzle changes timestamp parsers on its postgres-js client. Initialise it
  // before snapshots so migration replay cannot change their JS representation.
  drizzle(owner)
  runtime = postgres(process.env.PG_RUNTIME_URL!, { max: 1, onnotice: () => {} })
  const [count] = await owner`select count(*)::int as count from users`
  const tables = await owner`select tablename from pg_tables where schemaname='public' order by tablename`
  for (const { tablename } of tables) {
    const key = tablename === 'sessions' ? 'token_hash' : tablename === 'staff_profiles' ? 'user_id' : 'id'
    priorRows.push({ table: tablename, key, rows: [...await owner.unsafe(`select * from public.${tablename}`)] })
  }
  if (count!.count === 0) {
    const child = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/create-admin.ts', admin.email, `Responsable test ${run}`], {
    input: admin.password, encoding: 'utf8', timeout: 15000,
    env: { ...process.env, DATABASE_URL: process.env.PG_RUNTIME_URL, DOTENV_CONFIG_PATH: '__no_local_env__' },
  })
    if (child.status !== 0) throw new Error('Administrator CLI failed; sensitive child output suppressed')
  } else {
    // A regression fixture is a new account, never a reset or bootstrap bypass.
    // Production provisioning continues to reject databases with existing users.
    const passwordHash = await hashPassword(admin.password)
    await owner.begin(async tx => {
      const [user] = await tx`insert into users(email,password_hash,role) values(${admin.email},${passwordHash},'ADMIN') returning id`
      await tx`insert into staff_profiles(user_id,display_name) values(${user!.id},${`Responsable régression ${run}`})`
      await tx`insert into audit_logs(actor_id,action,entity_type,entity_id) values(${user!.id},'REGRESSION_FIXTURE_ADMIN','users',${user!.id})`
    })
  }
  adminContext = await browser.newContext()
  waiterContext = await browser.newContext()
})
test.afterAll(async () => {
  try {
    for (const prior of priorRows) {
      const rows = await owner.unsafe(`select * from public.${prior.table}`)
      for (const original of prior.rows) {
        const current = rows.find(row => row[prior.key] === original[prior.key])
        // Compare in memory; never include password hashes or tokens in failure output.
        const canonical = (row: Record<string, unknown> | undefined) => row && JSON.stringify(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)))
        if (canonical(current) !== canonical(original)) {
          const fields = Object.keys(original).filter(key => JSON.stringify(current?.[key]) !== JSON.stringify(original[key]))
          throw new Error('A pre-existing record changed in ' + prior.table + '; fields: ' + fields.join(','))
        }
      }
    }
    console.log('Pre-existing records unchanged across all twelve tables.')
  } finally {
    await adminContext?.close(); await waiterContext?.close()
    await runtime?.end(); await owner?.end()
  }
})
test('migration replay and twelve-table structure', async () => {
  const before = await structure()
  await migrate(drizzle(owner), { migrationsFolder: './drizzle' })
  expect(await structure()).toBe(before)
  expect((await owner`select tablename from pg_tables where schemaname='public'`)).toHaveLength(12)
  expect((await owner.unsafe('select * from drizzle.__drizzle_migrations'))).toHaveLength(1)
  const fk = await owner`select conname,pg_get_constraintdef(oid) as definition from pg_constraint where connamespace='public'::regnamespace and contype='f'`
  expect(fk).toHaveLength(14)
  expect(new Set(fk.map(x => x.conname)).size).toBe(14)
  expect(fk.some(x => x.definition.includes('FOREIGN KEY (variant_id, product_id)') && x.definition.includes('REFERENCES product_variants(id, product_id)'))).toBe(true)
})
test('ADMIN browser login and authorised creation of WAITER', async () => {
  const page = await adminContext.newPage()
  await page.goto(origin + '/connexion')
  await page.getByLabel('Adresse e-mail').fill(admin.email)
  await page.getByLabel('Mot de passe').fill(admin.password)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page).toHaveURL(/personnel/)
  await page.getByRole('link', { name: 'Administration', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible()
  const response = await adminContext.request.post(origin + '/api/management/staff', { headers: { origin }, data: { ...waiter, displayName: `Serveur test ${run}`, role: 'WAITER' } })
  expect(response.status()).toBe(200)
})
test('WAITER browser login and separate role contexts', async () => {
  const page = await waiterContext.newPage()
  await page.goto(origin + '/connexion')
  await page.getByLabel('Adresse e-mail').fill(waiter.email)
  await page.getByLabel('Mot de passe').fill(waiter.password)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page).toHaveURL(/personnel/)
  await expect(page.getByRole('link', { name: 'Administration', exact: true })).toHaveCount(0)
  await page.goto(origin + '/admin'); await expect(page).toHaveURL(/personnel/)
  const a = await (await adminContext.request.get(origin + '/api/auth/me')).json()
  const w = await (await waiterContext.request.get(origin + '/api/auth/me')).json()
  expect(a.role).toBe('ADMIN'); expect(w.role).toBe('WAITER'); expect(a.id).not.toBe(w.id)
})
test('wrong password and anonymous access rejected', async ({ request }) => {
  expect((await request.post('/api/auth/login', { headers: { origin }, data: { email: admin.email, password: randomBytes(24).toString('hex') } })).status()).toBe(401)
  expect((await request.get('/api/management/products')).status()).toBe(401)
})
test('ADMIN creates reads and updates synthetic products', async () => {
  const call = async (resource: string, data: unknown) => {
    const r = await adminContext.request.post(origin + '/api/management/' + resource, { headers: { origin }, data }); expect(r.status()).toBe(200); return r.json()
  }
  categoryId = (await call('categories', { name: `Catégorie test ${run}` })).id
  productId = (await call('products', { name: `Produit test ${run}`, categoryId })).id
  variantId = (await call('variants', { name: `Tarif fictif test ${run}`, productId, priceCents: 123 })).id
  const response = await adminContext.request.put(origin + '/api/management/products?id=' + productId, { headers: { origin }, data: { name: `Produit test modifié ${run}`, categoryId } })
  expect(response.status()).toBe(200)
  expect((await (await adminContext.request.get(origin + '/api/management/products')).json()).some((p: { id: string }) => p.id === productId)).toBe(true)
})
test('WAITER cannot alter price or perform management writes', async () => {
  expect((await waiterContext.request.put(origin + '/api/management/variants?id=' + variantId, { headers: { origin }, data: { name: `Tarif fictif test ${run}`, productId, priceCents: 999 } })).status()).toBe(403)
  expect((await owner`select price_cents from product_variants where id=${variantId}`)[0]!.price_cents).toBe(123)
  for (const resource of ['categories', 'products', 'variants', 'tables', 'staff']) expect((await waiterContext.request.post(origin + '/api/management/' + resource, { headers: { origin }, data: {} })).status()).toBe(403)
})
test('audit records contain the correct ADMIN actor', async () => {
  const [user] = await owner`select id from users where email=${admin.email}`
  const events = await owner`select action,actor_id from audit_logs where entity_id=${productId}`
  expect(events.map(e => e.action).sort()).toEqual(['POST', 'PUT'])
  expect(events.every(e => e.actor_id === user!.id)).toBe(true)
  expect((await owner`select id from audit_logs where action='CREATE_STAFF' and actor_id=${user!.id}`)).toHaveLength(1)
})
test('Zod CSRF malformed and oversized request protections', async () => {
  const url = origin + '/api/management/products'
  expect((await adminContext.request.post(url, { headers: { origin }, data: { name: '', categoryId } })).status()).toBe(400)
  expect((await adminContext.request.post(url, { headers: { origin: 'http://invalid.test' }, data: {} })).status()).toBe(403)
  expect((await adminContext.request.post(url, { headers: { origin }, data: { name: 'x'.repeat(20000), categoryId } })).status()).toBe(413)
  expect((await adminContext.request.post(url, { headers: { origin, 'content-type': 'application/json' }, data: '{broken' })).status()).toBe(400)
})
test('historical order price is independent from catalogue edits', async () => {
  const [user] = await owner`select id from users where email=${admin.email}`
  const [table] = await owner`insert into restaurant_tables(name,capacity) values(${`Table test ${run}`},2) returning id`
  const [visit] = await owner`insert into table_visits(table_id,opened_by) values(${table!.id},${user!.id}) returning id`
  const [order] = await owner`insert into orders(visit_id,created_by) values(${visit!.id},${user!.id}) returning id`
  const [item] = await owner`insert into order_items(order_id,product_id,variant_id,product_name,variant_name,unit_price_cents,quantity) values(${order!.id},${productId},${variantId},${`Produit test ${run}`},${`Tarif fictif test ${run}`},123,2) returning id`
  expect((await adminContext.request.put(origin + '/api/management/variants?id=' + variantId, { headers: { origin }, data: { name: `Tarif fictif test ${run}`, productId, priceCents: 456 } })).status()).toBe(200)
  expect((await owner`select unit_price_cents from order_items where id=${item!.id}`)[0]!.unit_price_cents).toBe(123)
})
test('transaction rollback after a real foreign-key error', async () => {
  const name = `Rollback test ${run}`
  let failed = false
  try { await owner.begin(async tx => { await tx`insert into categories(name) values(${name})`; await tx`insert into product_variants(product_id,name,price_cents) values(${randomUUID()},${name},1)` }) } catch (e) { failed = (e as { code?: string }).code === '23503' }
  expect(failed).toBe(true)
  expect(await owner`select id from categories where name=${name}`).toHaveLength(0)
})
test('database privilege separation', async () => {
  const [p] = await runtime`select current_user,has_schema_privilege(current_user,'public','CREATE') as ddl,pg_has_role(current_user,'gourmet_asie_migrator','MEMBER') as member`
  expect(p).toMatchObject({ current_user: 'gourmet_asie_app', ddl: false, member: false })
  let denied = false
  try { await runtime.unsafe('SELECT * FROM drizzle.__drizzle_migrations LIMIT 0') } catch (e) { denied = (e as { code?: string }).code === '42501' }
  expect(denied).toBe(true)
  expect((await owner`select rolsuper,rolcreatedb,rolcreaterole from pg_roles where rolname=current_user`)[0]).toMatchObject({ rolsuper: false, rolcreatedb: false, rolcreaterole: false })
})
test('expiration and logout revoke only new test sessions', async ({ browser }) => {
  const context = await browser.newContext()
  try {
    expect((await context.request.post(origin + '/api/auth/login', { headers: { origin }, data: waiter })).status()).toBe(200)
    const cookies = await context.cookies(origin)
    const token = cookies.find(c => c.name === 'gourmet_session')!.value
    const hash = createHash('sha256').update(token).digest('hex')
    await owner`update sessions set expires_at=now()-interval '1 minute' where token_hash=${hash}`
    expect((await context.request.get(origin + '/api/auth/me')).status()).toBe(401)
  } finally { await context.close() }
  const page = waiterContext.pages()[0]!
  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await expect(page).toHaveURL(/connexion/)
  expect((await waiterContext.request.get(origin + '/api/auth/me')).status()).toBe(401)
  expect((await adminContext.request.get(origin + '/api/auth/me')).status()).toBe(200)
})
