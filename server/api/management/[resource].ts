import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import { getJsonBody } from '../../http/request-body'
import { eq, asc } from 'drizzle-orm'
import { z } from 'zod'
import { requireStaff } from '../../auth/session'
import { getDb } from '../../database/client'
import { categories, products, productVariants, restaurantTables, auditLogs } from '../../database/schema'
import { categorySchema, productSchema, variantSchema, tableSchema } from '../../../shared/validation/management'
const resources = {
  categories: { table: categories, schema: categorySchema },
  products: { table: products, schema: productSchema },
  variants: { table: productVariants, schema: variantSchema },
  tables: { table: restaurantTables, schema: tableSchema },
}
export default defineEventHandler(async event => {
  const staff = await requireStaff(event, event.method !== 'GET')
  const key = getRouterParam(event, 'resource') as keyof typeof resources
  const resource = Object.hasOwn(resources, key) ? resources[key] : undefined
  if (!resource) throw createError({ statusCode: 404, message: 'Ressource introuvable' })
  const db = getDb()
  if (event.method === 'GET') return db.select().from(resource.table).orderBy(asc(resource.table.name)).limit(1000)
  if (!['POST', 'PUT', 'DELETE'].includes(event.method)) throw createError({ statusCode: 405, message: 'Méthode non autorisée' })
  const id = event.method === 'POST' ? undefined : z.uuid().safeParse(getQuery(event).id)
  if (id && !id.success) throw createError({ statusCode: 400, message: 'Identifiant invalide' })
  const parsed = event.method === 'DELETE' ? null : resource.schema.safeParse(getJsonBody(event))
  if (parsed && !parsed.success) throw createError({ statusCode: 400, message: 'Données invalides' })
  try {
    return await db.transaction(async tx => {
      let rows
      if (event.method === 'POST' && parsed?.success) {
        // The schema selected above validates the resource-specific insert shape.
        rows = await tx.insert(resource.table).values(parsed.data as typeof categories.$inferInsert).returning()
      } else if (event.method === 'PUT' && id?.success && parsed?.success) {
        rows = await tx.update(resource.table).set({ ...parsed.data, updatedAt: new Date() }).where(eq(resource.table.id, id.data)).returning()
      } else if (id?.success) {
        rows = await tx.delete(resource.table).where(eq(resource.table.id, id.data)).returning()
      }
      if (!rows?.[0]) throw createError({ statusCode: 404, message: 'Enregistrement introuvable' })
      await tx.insert(auditLogs).values({ actorId: staff.id, action: event.method, entityType: key, entityId: rows[0].id })
      return rows[0]
    })
  } catch (error) {
    const cause = error as { code?: string; cause?: { code?: string } }
    if (['23503', '23505', '23514'].includes(cause.code ?? cause.cause?.code ?? '')) throw createError({ statusCode: 409, message: 'Conflit de données ou enregistrement utilisé' })
    throw error
  }
})
