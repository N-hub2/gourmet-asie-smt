import { IncomingMessage } from 'node:http'
import { createError, getHeader, getRequestWebStream, setHeader, type H3Event } from 'h3'

export const MAX_BODY_BYTES = 16 * 1024
const bodies = new WeakMap<H3Event, unknown>()
const tooLarge = () => createError({ statusCode: 413, message: 'Requête trop volumineuse' })

function closeAfterResponse(event: H3Event) {
  if (!(event.node.req instanceof IncomingMessage)) return
  event.node.req.pause()
  event.node.res.shouldKeepAlive = false
  setHeader(event, 'Connection', 'close')
}

// Finish small in-flight uploads before closing, without buffering their bytes.
// An unfinished or unbounded upload delays the 413 by at most 200 ms.
async function settleRejectedUpload(event: H3Event) {
  if (!(event.node.req instanceof IncomingMessage) || event.node.req.readableEnded) return
  await new Promise<void>(resolve => {
    const request = event.node.req
    const finish = () => {
      clearTimeout(deadline)
      request.off('end', finish); request.off('aborted', finish); request.off('error', finish)
      request.pause()
      resolve()
    }
    const deadline = setTimeout(finish, 200)
    request.once('end', finish).once('aborted', finish).once('error', finish)
    request.resume()
  })
}

function readNodeBody(event: H3Event): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const request = event.node.req
    const buffer = Buffer.alloc(MAX_BODY_BYTES)
    let size = 0
    const cleanup = () => {
      request.off('data', onData)
      request.off('end', onEnd)
      request.off('error', onError)
      request.off('aborted', onAborted)
    }
    const onError = () => { cleanup(); reject(createError({ statusCode: 400, message: 'Lecture de la requête impossible' })) }
    const onAborted = () => onError()
    const onEnd = () => { cleanup(); resolve(buffer.subarray(0, size)) }
    const onData = (chunk: Buffer) => {
      if (size + chunk.length > MAX_BODY_BYTES) {
        cleanup()
        void settleRejectedUpload(event).then(() => { closeAfterResponse(event); reject(tooLarge()) })
        return
      }
      chunk.copy(buffer, size)
      size += chunk.length
    }
    request.on('data', onData).once('end', onEnd).once('error', onError).once('aborted', onAborted)
    if (request.aborted) onAborted()
    else if (request.readableEnded) onEnd()
  })
}

async function readWebBody(event: H3Event): Promise<Buffer> {
  const reader = getRequestWebStream(event)?.getReader()
  if (!reader) return Buffer.alloc(0)
  const buffer = Buffer.alloc(MAX_BODY_BYTES)
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) return buffer.subarray(0, size)
      if (size + value.byteLength > MAX_BODY_BYTES) {
        // Do not wait for a potentially uncooperative upstream cancellation.
        void reader.cancel().catch(() => {})
        throw tooLarge()
      }
      buffer.set(value, size)
      size += value.byteLength
    }
  } finally { reader.releaseLock() }
}

export async function receiveJsonBody(event: H3Event): Promise<void> {
  if (bodies.has(event)) return
  if (Number(getHeader(event, 'content-length')) > MAX_BODY_BYTES) {
    await settleRejectedUpload(event)
    closeAfterResponse(event)
    throw tooLarge()
  }
  const buffer = await (event.node.req instanceof IncomingMessage ? readNodeBody(event) : readWebBody(event))
  // Empty bodies remain valid for logout and DELETE; schemas reject them where required.
  try { bodies.set(event, buffer.length ? JSON.parse(buffer.toString('utf8')) : undefined) }
  catch { throw createError({ statusCode: 400, message: 'Corps JSON invalide' }) }
}

export function getJsonBody(event: H3Event): unknown {
  if (!bodies.has(event)) throw createError({ statusCode: 500, message: 'Contrôle du corps de requête manquant' })
  return bodies.get(event)
}
