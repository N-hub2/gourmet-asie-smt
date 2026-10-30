import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'
let client: ReturnType<typeof drizzle<typeof schema>> | undefined
export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquante')
  return client ??= drizzle(postgres(process.env.DATABASE_URL, { max: 10 }), { schema })
}
