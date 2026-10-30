import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createServer, request as httpRequest } from 'node:http'
import { createApp, defineEventHandler, toNodeListener, toWebHandler } from 'h3'
import security from '../server/middleware/security'
import { getJsonBody, MAX_BODY_BYTES } from '../server/http/request-body'

const handler = vi.fn()
const app = createApp().use(security).use(defineEventHandler(event => { handler(); return getJsonBody(event) }))
const server = createServer(toNodeListener(app))
let port: number
beforeAll(async () => {
  process.env.APP_ORIGIN = 'http://localhost:3000'
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server unavailable')
  port = address.port
})
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) })

function sendChunks(chunks: Buffer[], extraHeaders: Record<string, string> = {}, finish = true) {
  return new Promise<{ status: number; body: string; connection: string | undefined }>((resolve, reject) => {
    const request = httpRequest({ host: '127.0.0.1', port, path: '/api/probe', method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', ...extraHeaders } }, response => {
      let body = ''
      response.setEncoding('utf8').on('data', chunk => { body += chunk }).once('end', () => {
        resolve({ status: response.statusCode!, body, connection: response.headers.connection })
        request.destroy()
      })
    })
    request.on('error', reject)
    request.flushHeaders()
    for (const chunk of chunks) request.write(chunk)
    if (finish) request.end()
  })
}

describe('Lecture bornée du corps HTTP', () => {
  it('conserve une requête JSON ordinaire transmise en plusieurs morceaux', async () => {
    const response = await sendChunks([Buffer.from('{"value":'), Buffer.from('"bonjour"}')])
    expect(response.status).toBe(200)
    expect(JSON.parse(response.body)).toEqual({ value: 'bonjour' })
  })
  it('accepte exactement la limite en octets', async () => {
    const body = Buffer.from(JSON.stringify({ value: 'x'.repeat(MAX_BODY_BYTES - 12) }))
    expect(body.byteLength).toBe(MAX_BODY_BYTES)
    expect((await sendChunks([body])).status).toBe(200)
  })
  it('refuse la limite plus un octet en Chunked', async () => {
    handler.mockClear()
    const body = Buffer.from(JSON.stringify({ value: 'x'.repeat(MAX_BODY_BYTES - 11) }))
    const response = await sendChunks([body.subarray(0, 8192), body.subarray(8192)], { 'transfer-encoding': 'chunked' })
    expect(response.status).toBe(413)
    expect(response.connection).toBe('close')
    expect(handler).not.toHaveBeenCalled()
  })
  it('répond 413 sans attendre la fin d’un téléversement trop grand', async () => {
    handler.mockClear()
    const response = await sendChunks([Buffer.alloc(8192), Buffer.alloc(8192), Buffer.alloc(1)], {}, false)
    expect(response.status).toBe(413)
    expect(handler).not.toHaveBeenCalled()
  })
  it('mesure les octets UTF-8 plutôt que les caractères', async () => {
    const response = await sendChunks([Buffer.from(JSON.stringify({ value: 'é'.repeat(9000) }))])
    expect(response.status).toBe(413)
  })
  it('refuse immédiatement une taille déclarée supérieure à la limite', async () => {
    handler.mockClear()
    const response = await sendChunks([], { 'content-length': String(MAX_BODY_BYTES + 1) }, false)
    expect(response.status).toBe(413)
    expect(handler).not.toHaveBeenCalled()
  })
  it('refuse du JSON mal formé et laisse fonctionner la requête suivante', async () => {
    expect((await sendChunks([Buffer.from('{')])).status).toBe(400)
    expect((await sendChunks([Buffer.from('{}')])).status).toBe(200)
  })
  it('annule aussi un flux Web sans Content-Length avant son épuisement', async () => {
    handler.mockClear()
    const cancel = vi.fn()
    let pulls = 0
    const body = new ReadableStream<Uint8Array>({ pull(controller) { pulls++; controller.enqueue(new Uint8Array(4096)) }, cancel })
    const request = new Request('http://localhost:3000/api/probe', { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body, duplex: 'half' } as RequestInit)
    const response = await toWebHandler(app)(request)
    expect(response.status).toBe(413)
    expect(cancel).toHaveBeenCalledOnce()
    expect(pulls).toBeLessThanOrEqual(6)
    expect(handler).not.toHaveBeenCalled()
  })
  it('ne fait pas confiance à un Content-Length Web inférieur à la taille reçue', async () => {
    handler.mockClear()
    const request = new Request('http://localhost:3000/api/probe', { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', 'content-length': '1' }, body: JSON.stringify({ value: 'x'.repeat(MAX_BODY_BYTES) }) })
    expect((await toWebHandler(app)(request)).status).toBe(413)
    expect(handler).not.toHaveBeenCalled()
  })
  it('accepte aussi une requête Web normale sans Content-Length', async () => {
    const request = new Request('http://localhost:3000/api/probe', { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: '{"value":"normal"}' })
    const response = await toWebHandler(app)(request)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ value: 'normal' })
  })
})
