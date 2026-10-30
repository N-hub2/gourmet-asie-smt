import 'dotenv/config'
import { readFileSync } from 'node:fs'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../server/database/schema'
import { staffSchema } from '../shared/validation/management'
import { provisionInitialAdmin } from '../server/auth/provision-admin'
// Password comes from stdin, never a command argument or committed environment file.
const input = staffSchema.parse({ email: process.argv[2], displayName: process.argv[3], password: readFileSync(0, 'utf8').replace(/\r?\n$/, ''), role: 'ADMIN' })
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL requise')
const client = postgres(process.env.DATABASE_URL, { max: 1 })
try {
  await provisionInitialAdmin(drizzle(client, { schema }), input)
  console.log('Administrateur initial créé.')
} finally { await client.end() }
