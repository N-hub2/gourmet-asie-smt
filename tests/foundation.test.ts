import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, tokenHash } from '../server/auth/password'
import { categorySchema, variantSchema, tableSchema, staffSchema } from '../shared/validation/management'
describe('Authentification et validation', () => {
  it('sale les mots de passe et vérifie les secrets', async () => {
    const hash = await hashPassword('un-secret-uniquement-pour-les-tests')
    expect(hash).not.toContain('un-secret')
    expect(await hashPassword('un-secret-uniquement-pour-les-tests')).not.toBe(hash)
    expect(await verifyPassword('un-secret-uniquement-pour-les-tests', hash)).toBe(true)
    expect(await verifyPassword('incorrect', hash)).toBe(false)
    expect(await verifyPassword('incorrect', 'invalid')).toBe(false)
    expect(tokenHash('token')).toHaveLength(64)
  })
  it('refuse prix négatifs ou fractionnaires et relations invalides', () => {
    for (const priceCents of [-1, 1.5, 10000001]) expect(variantSchema.safeParse({ name: 'Test', productId: crypto.randomUUID(), priceCents }).success).toBe(false)
    expect(variantSchema.safeParse({ name: 'Test', productId: 'invalid', priceCents: 1 }).success).toBe(false)
    expect(tableSchema.safeParse({ name: 'Test', capacity: 0 }).success).toBe(false)
    expect(categorySchema.safeParse({ name: ' ', role: 'ADMIN' }).success).toBe(false)
    expect(staffSchema.safeParse({ email: 'a@example.test', displayName: 'Test', role: 'ADMIN', password: 'short' }).success).toBe(false)
  })
})
