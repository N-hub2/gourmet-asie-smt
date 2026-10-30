import { defineEventHandler, getHeader, createError, setHeader } from 'h3'
import { receiveJsonBody } from '../http/request-body'
export default defineEventHandler(async event => {
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'X-Frame-Options', 'DENY')
  setHeader(event, 'Referrer-Policy', 'same-origin')
  if (!event.path.startsWith('/api/')) return
  setHeader(event, 'Cache-Control', 'no-store')
  if (['GET', 'HEAD', 'OPTIONS'].includes(event.method)) return
  const origin = process.env.APP_ORIGIN
  if (!origin || getHeader(event, 'origin') !== origin) throw createError({ statusCode: 403, message: 'Origine non autorisée' })
  if (!getHeader(event, 'content-type')?.startsWith('application/json')) throw createError({ statusCode: 415, message: 'Format JSON requis' })
  await receiveJsonBody(event)
})
