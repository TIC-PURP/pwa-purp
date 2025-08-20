export const runtime = 'nodejs';

function getServerOrigin() {
  const raw = process.env.NEXT_PUBLIC_COUCHDB_URL;
  if (!raw) throw new Error('NEXT_PUBLIC_COUCHDB_URL is required');
  const u = new URL(raw);
  return `${u.protocol}//${u.host}`;
}

async function proxy(req: Request, path: string[]) {
  const server = getServerOrigin();
  const url = `${server}/${path.join('/')}`.replace(/\/+$/, '');
  const headers = new Headers(req.headers);
  headers.delete('host');
  // Browsers set cookies automatically for same host; here we just forward.
  let body: any = undefined;
if (req.method !== 'GET' && req.method !== 'HEAD') {
  // Clone body as ArrayBuffer to avoid stream issues
  const ab = await req.arrayBuffer();
  body = Buffer.from(ab);
}
const res = await fetch(url, {
    method: req.method,
    headers,
    body,
    redirect: 'manual',
  });
  const outHeaders = new Headers(res.headers);
  // Ensure Set-Cookie is preserved to client
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) outHeaders.set('set-cookie', setCookie);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: outHeaders });
}

export const GET = (req: Request, ctx: any) => proxy(req, ctx.params?.path || []);
export const POST = (req: Request, ctx: any) => proxy(req, ctx.params?.path || []);
export const PUT = (req: Request, ctx: any) => proxy(req, ctx.params?.path || []);
export const PATCH = (req: Request, ctx: any) => proxy(req, ctx.params?.path || []);
export const DELETE = (req: Request, ctx: any) => proxy(req, ctx.params?.path || []);
export const HEAD = (req: Request, ctx: any) => proxy(req, ctx.params?.path || []);
export const OPTIONS = (req: Request, ctx: any) => proxy(req, ctx.params?.path || []);
