import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto'
const scrypt = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scryptCallback(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key))
})
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const key = await scrypt(password, salt)
  return `scrypt-v1:${salt}:${key.toString('hex')}`
}
export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, hex] = stored.split(':')
  if (algorithm !== 'scrypt-v1' || !salt || !/^[a-f0-9]{32}$/.test(salt) || !hex || !/^[a-f0-9]{128}$/.test(hex)) return false
  return timingSafeEqual(await scrypt(password, salt), Buffer.from(hex, 'hex'))
}
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
