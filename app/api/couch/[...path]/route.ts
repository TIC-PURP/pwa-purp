import type { NextRequest } from 'next/server';

export const runtime = 'edge';

const BASE = process.env.COUCHDB_BASE_URL!; // e.g. https://d2zfthqcwakql2.cloudfront.net
const USER = process.env.COUCHDB_USER!;
const PASS = process.env.COUCHDB_PASS!;

// Safe base64 for Edge/Node
const toBase64 = (s: string) => (globalThis as any).btoa ? btoa(s) : Buffer.from(s, 'utf8').toString('base64');

function buildTarget(path: string[]) {
  const sub = (path || []).join('/');
  return `${BASE.replace(/\/$/, '')}/${sub}`;
}

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const url = buildTarget(params?.path || []);

  const headers = new Headers(req.headers);
  // Do NOT inject admin auth on _session to let username/password pass through
  if (!url.endsWith('/_session')) {
    headers.set('authorization', 'Basic ' + toBase64(`${USER}:${PASS}`));
  }
  ['host', 'connection', 'accept-encoding', 'content-length'].forEach(h => headers.delete(h));

  const init: RequestInit = {
    method: req.method,
    headers,
    body: ['GET','HEAD'].includes(req.method) ? undefined : await req.arrayBuffer(),
    redirect: 'manual',
  };

  const resp = await fetch(url, init);
  const out = new Headers(resp.headers);
  out.set('cache-control', 'no-store');

  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: out });
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as HEAD, handler as OPTIONS };
