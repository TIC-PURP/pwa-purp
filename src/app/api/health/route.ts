export const runtime = 'edge';

function getServerBase() {
  const raw = process.env.NEXT_PUBLIC_COUCHDB_URL;
  if (!raw) throw new Error('NEXT_PUBLIC_COUCHDB_URL not set');
  const u = new URL(raw);
  return `${u.protocol}//${u.host}`;
}

export async function GET() {
  const base = getServerBase();
  // Ask CouchDB whoami; if cookie is present it shows the user context.
  const res = await fetch(`${base}/_session`, { headers: { 'Accept': 'application/json' }, redirect: 'manual' });
  const data = await res.json().catch(() => ({}));
  return new Response(JSON.stringify({ ok: res.ok, status: res.status, couch: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
