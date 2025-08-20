import { test, expect, request } from '@playwright/test';

const user = process.env.TEST_COUCH_USER;
const pass = process.env.TEST_COUCH_PASS;
const dbUrl = process.env.NEXT_PUBLIC_COUCHDB_URL || '';

// Extract db name for _changes call
function getDbName(raw: string) {
  try {
    const u = new URL(raw);
    const parts = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    return parts.pop() || 'gestion_pwa';
  } catch { return 'gestion_pwa'; }
}

test('POST /api/couch/_session should set AuthSession cookie when creds provided', async ({ baseURL, request }) => {
  test.skip(!user || !pass, 'Set TEST_COUCH_USER and TEST_COUCH_PASS to run this test');
  const res = await request.post('/api/couch/_session', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: `name=${encodeURIComponent(user!)}&password=${encodeURIComponent(pass!)}`,
  });
  expect(res.status()).toBe(200);
  // Playwright exposes cookies via Set-Cookie header
  const setCookie = res.headers()['set-cookie'];
  expect(setCookie).toBeTruthy();
  expect(setCookie).toContain('AuthSession=');
});

test('GET /api/couchdb/<db>/_changes should work with AuthSession cookie', async ({ baseURL, request }) => {
  test.skip(!user || !pass, 'Set TEST_COUCH_USER and TEST_COUCH_PASS to run this test');
  // login first
  const loginRes = await request.post('/api/couch/_session', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: `name=${encodeURIComponent(user!)}&password=${encodeURIComponent(pass!)}`,
  });
  expect(loginRes.status()).toBe(200);
  const setCookie = loginRes.headers()['set-cookie'] || '';
  const authCookie = setCookie.split(',').find((c) => c.includes('AuthSession=')) || '';

  const dbName = getDbName(dbUrl);
  const changes = await request.get(`/api/couchdb/${dbName}/_changes?limit=1`, {
    headers: { Cookie: authCookie.split(';')[0] },
  });
  expect(changes.status()).toBe(200);
});
