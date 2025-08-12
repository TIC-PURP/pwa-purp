import type { NextApiRequest, NextApiResponse } from 'next'

export const config = { api: { bodyParser: false } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const BASE = process.env.COUCHDB_BASE_URL!
  const USER = process.env.COUCHDB_USER!
  const PASS = process.env.COUCHDB_PASS!

  const sub = (req.query.path as string[] || []).join('/')
  const url = `${BASE}/${sub}`

  const headers = new Headers()
  Object.entries(req.headers).forEach(([k,v]) => {
    if (!v) return
    if (['host','connection','accept-encoding','content-length'].includes(k)) return
    headers.set(k, Array.isArray(v) ? v.join(', ') : v.toString())
  })
  headers.set('authorization', 'Basic ' + Buffer.from(`${USER}:${PASS}`, 'utf8').toString('base64'))

  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : (req as any)
  const resp = await fetch(url, { method: req.method, headers, body: body as any, redirect: 'manual' })
  res.status(resp.status)
  resp.headers.forEach((val, key) => {
    if (key.toLowerCase() === 'content-encoding') return
    res.setHeader(key, val)
  })
  res.setHeader('cache-control','no-store')
  const buf = Buffer.from(await resp.arrayBuffer())
  res.send(buf)
}
