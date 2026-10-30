import { test, expect } from '@playwright/test'
test('connexion mobile et protection des pages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin')
  await expect(page).toHaveURL(/connexion/)
  await expect(page.getByRole('heading', { name: 'Connexion du personnel' })).toBeVisible()
  await expect(page.getByLabel('Adresse e-mail')).toBeVisible()
  await expect(page.getByLabel('Mot de passe')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('le serveur compilé refuse les grands corps avant la connexion à la base', async ({ request }) => {
  const headers = { origin: 'http://localhost:3100' }
  const large = await request.post('/api/auth/login', { headers, data: { email: 'review@example.test', password: 'x'.repeat(20000) } })
  expect(large.status()).toBe(413)
  const malformed = await request.post('/api/auth/login', { headers: { ...headers, 'content-type': 'application/json' }, data: '{invalid' })
  expect(malformed.status()).toBe(400)
})
