import { z } from 'zod'
const name = z.string().trim().min(1).max(120)
export const loginSchema = z.object({ email: z.email().trim().toLowerCase(), password: z.string().min(1).max(256) }).strict()
export const passwordSchema = z.string().min(15).max(128)
export const categorySchema = z.object({ name, active: z.boolean().default(true) }).strict()
export const productSchema = z.object({ name, categoryId: z.uuid(), active: z.boolean().default(true) }).strict()
export const variantSchema = z.object({ name, productId: z.uuid(), priceCents: z.number().int().min(0).max(10000000), active: z.boolean().default(true) }).strict()
export const tableSchema = z.object({ name, capacity: z.number().int().min(1).max(100), active: z.boolean().default(true) }).strict()
export const staffSchema = z.object({ email: z.email().trim().toLowerCase(), password: passwordSchema, displayName: name, role: z.enum(['ADMIN', 'WAITER']) }).strict()
