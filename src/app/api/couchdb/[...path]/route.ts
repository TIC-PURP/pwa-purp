export const runtime = 'edge';

function getTargets() {
  const raw = process.env.NEXT_PUBLIC_COUCHDB_URL;
  if (!raw) throw new Error('NEXT_PUBLIC_COUCHDB_URL is required');
  const u = new URL(raw);
  const server = `${u.protocol}//${u.host}`;
  const parts = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const dbName = parts.pop() || 'gestion_pwa';
  return { server, dbName };
}

async function proxy(req: Request, path: string[]) {
  const { server, dbName } = getTargets();
  const url = `${server}/${dbName}/${path.join('/')}`.replace(/\/+$/, '');
  const headers = new Headers(req.headers);
  headers.delete('host');
  const res = await fetch(url, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
    redirect: 'manual',
  });
  const outHeaders = new Headers(res.headers);
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
