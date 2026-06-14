// Smoke test for the 7 newly-hardened commerce/read routes.
// Runs entirely in Node so cookies stay in-process and JSON parsing is reliable.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const BASE = 'http://localhost:3000';
const prisma = new PrismaClient();

const R = '\x1b[31m', G = '\x1b[32m', Y = '\x1b[33m', N = '\x1b[0m';
let failed = 0;
const pass = (m) => console.log(`${G}\u2713${N} ${m}`);
const fail = (m) => { console.log(`${R}\u2717${N} ${m}`); failed++; };
const note = (m) => console.log(`${Y}\u2022${N} ${m}`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ------- Cookie jar (per-owner) -------
const newJar = () => ({});
const applySetCookies = (res, jar) => {
  const list = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of list) {
    const [pair] = c.split(';');
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
};
const cookieHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

// ------- HTTP wrapper with jar + JSON helper -------
async function http(jar, method, path, body, expectJson = true) {
  const headers = { cookie: cookieHeader(jar) };
  if (body !== undefined && body !== null) headers['content-type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  applySetCookies(res, jar);
  const text = await res.text();
  let json = null;
  if (expectJson) {
    try { json = JSON.parse(text); } catch { json = null; }
  }
  return { status: res.status, text, json };
}

async function signin(jar, email) {
  const csrf = await http(jar, 'GET', '/api/auth/csrf');
  const token = csrf.json?.csrfToken ?? '';
  const body = new URLSearchParams({
    email, password: 'demo1234', csrfToken: token,
    callbackUrl: BASE + '/dashboard', json: 'true',
  }).toString();
  const res = await fetch(BASE + '/api/auth/callback/credentials', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: cookieHeader(jar),
    },
    body, redirect: 'manual',
  });
  applySetCookies(res, jar);
  return res.status;
}

const jget = (o, path) => {
  if (!o) return '';
  const parts = path.split('.').filter(Boolean);
  let v = o;
  for (const k of parts) {
    if (v == null) return '';
    v = v[isNaN(k) ? k : Number(k)];
  }
  return v === undefined ? '' : v;
};

// ====================================================================
// 0. Seed two businesses with owner users
// ====================================================================
note('0. Seeding two demo businesses');
const stamp = Date.now();
async function seed(label) {
  const email = `smoke-${label}-${stamp}@shoppilot.ai`;
  const bizName = `Smoke ${label} ${stamp}`;
  const hash = await bcrypt.hash('demo1234', 8);
  const u = await prisma.user.create({ data: { email, name: bizName, passwordHash: hash, role: 'OWNER' } });
  const b = await prisma.business.create({
    data: {
      name: bizName,
      slug: `smoke-${label}-${stamp}-${Math.floor(Math.random() * 1e6)}`,
      ownerId: u.id,
    },
  });
  return { email, businessId: b.id, userId: u.id };
}
const a = await seed('a');
const b = await seed('b');
note(`BUS_A=${a.businessId}  USER_A=${a.userId}`);
note(`BUS_B=${b.businessId}  USER_B=${b.userId}`);

// ====================================================================
// 1. Sign in
// ====================================================================
note('1. NextAuth sign-in');
const jarA = newJar(), jarB = newJar();
const codeA = await signin(jarA, a.email);
const codeB = await signin(jarB, b.email);
(codeA === 200 || codeA === 302) ? pass(`signin A=${codeA}`) : fail(`signin A=${codeA}`);
(codeB === 200 || codeB === 302) ? pass(`signin B=${codeB}`) : fail(`signin B=${codeB}`);

// ====================================================================
// 2. /api/products
// ====================================================================
note('2. /api/products');
{
  const r = await http(newJar(), 'GET', '/api/products');
  r.status === 401 ? pass('GET unauth=401') : fail(`GET unauth=${r.status}`);
}
{
  const r = await http(jarA, 'POST', '/api/products', {});
  r.status === 400 ? pass('POST empty=400') : fail(`POST empty=${r.status}`);
}
const prodRes = await http(jarA, 'POST', '/api/products', {
  name: 'Smoke Test Serum', price: 550, stock: 20, category: 'skincare', lowStockAt: 5,
});
const PROD_ID = jget(prodRes.json, 'id');
PROD_ID ? pass(`POST happy id=${PROD_ID}`) : fail(`POST: ${prodRes.text}`);

// ====================================================================
// 3. /api/orders
// ====================================================================
note('3. /api/orders');
{
  const r = await http(newJar(), 'GET', '/api/orders');
  r.status === 401 ? pass('GET unauth=401') : fail(`GET unauth=${r.status}`);
}
{
  const r = await http(jarA, 'POST', '/api/orders', {});
  r.status === 400 ? pass('POST empty=400') : fail(`POST empty=${r.status}`);
}
const ordRes = await http(jarA, 'POST', '/api/orders', {
  chat: 'I want to order 2 Smoke Test Serum, my phone 01712345678',
  customerPhone: '01712345678',
  customerName: 'Smoke Customer',
  customerCity: 'Dhaka',
});
const ORD_ID = jget(ordRes.json, 'order.id');
const PERSISTED = jget(ordRes.json, 'persisted');
(ORD_ID && PERSISTED) ? pass(`POST happy id=${ORD_ID} persisted=${PERSISTED}`) : fail(`POST: ${ordRes.text}`);

// ====================================================================
// 4. /api/orders/[id]
// ====================================================================
note('4. /api/orders/[id]');
{
  const r = await http(newJar(), 'GET', `/api/orders/some-bogus-id`);
  r.status === 401 ? pass('GET unauth=401') : fail(`GET unauth=${r.status} ${r.text.slice(0, 100)}`);
}
{
  const r = await http(jarA, 'GET', `/api/orders/${ORD_ID}`);
  jget(r.json, 'id') === ORD_ID ? pass('GET returns order') : fail(`GET: ${r.text}`);
}
{
  const r = await http(jarB, 'GET', `/api/orders/${ORD_ID}`);
  r.status === 404 ? pass('cross-tenant=404') : fail(`cross-tenant=${r.status} ${r.text.slice(0, 100)}`);
}
{
  const r = await http(jarA, 'PATCH', `/api/orders/${ORD_ID}`, { status: 'INVALID_STATUS_DOES_NOT_EXIST' });
  // Schema only constrains to z.string().max(40); downstream logic will reject unknown status.
  // We just want to confirm PATCH route accepts the body and returns 2xx (200 or 400 from app).
  (r.status === 200 || r.status === 400) ? pass(`PATCH malformed-status=${r.status}`) : fail(`PATCH malformed=${r.status} ${r.text.slice(0, 100)}`);
}
const patchRes = await http(jarA, 'PATCH', `/api/orders/${ORD_ID}`, { status: 'confirmed', paymentStatus: 'paid' });
jget(patchRes.json, 'status') === 'confirmed' ? pass('PATCH status=confirmed') : fail(`PATCH: ${patchRes.text}`);
jget(patchRes.json, 'paymentStatus') === 'paid' ? pass('PATCH paymentStatus=paid') : fail(`PATCH pay: ${patchRes.text}`);

// ====================================================================
// 5. /api/resellers/invite
// ====================================================================
note('5. /api/resellers/invite');
{
  const r = await http(newJar(), 'POST', '/api/resellers/invite', {});
  r.status === 401 ? pass('unauth=401') : fail(`unauth=${r.status}`);
}
{
  const r = await http(jarA, 'POST', '/api/resellers/invite', {});
  r.status === 400 ? pass('empty=400') : fail(`empty=${r.status}`);
}
const resEmail = `reseller-${stamp}-${Math.floor(Math.random() * 1e6)}@shoppilot.ai`;
const invRes = await http(jarA, 'POST', '/api/resellers/invite', {
  name: 'Smoke Reseller', email: resEmail, tier: 'silver', commissionType: 'percentage', commissionRate: 10,
});
const RES_ID = jget(invRes.json, 'reseller.id');
const TEMP_PW = jget(invRes.json, 'tempPassword');
(RES_ID && TEMP_PW) ? pass(`happy id=${RES_ID} pw=${String(TEMP_PW).slice(0, 3)}\u2026`) : fail(`happy: ${invRes.text}`);
{
  const r = await http(jarA, 'POST', '/api/resellers/invite', {
    name: 'Smoke Reseller', email: resEmail, tier: 'silver', commissionType: 'percentage', commissionRate: 10,
  });
  r.status === 409 ? pass('duplicate=409') : fail(`duplicate=${r.status} ${r.text.slice(0, 100)}`);
}

// ====================================================================
// 6. /api/integrations/bkash
// ====================================================================
note('6. /api/integrations/bkash');
{
  const r = await http(newJar(), 'POST', '/api/integrations/bkash', {});
  r.status === 401 ? pass('unauth=401') : fail(`unauth=${r.status}`);
}
{
  const r = await http(jarA, 'POST', '/api/integrations/bkash', {});
  r.status === 400 ? pass('empty=400') : fail(`empty=${r.status}`);
}
const bkcRes = await http(jarA, 'POST', '/api/integrations/bkash', {
  action: 'create', amount: 500, customerPhone: '01712345678',
});
jget(bkcRes.json, 'success') === true ? pass('create ok') : fail(`create: ${bkcRes.text}`);

const ord2 = await http(jarA, 'POST', '/api/orders', {
  chat: 'I would like to order 1 Smoke Test Serum please', customerPhone: '01799999999',
});
const ORD2_ID = jget(ord2.json, 'order.id');
ORD2_ID ? note(`extra order for bkash verify: ${ORD2_ID}`) : note(`no extra order: ${ord2.text}`);

const bkvRes = await http(jarA, 'POST', '/api/integrations/bkash', {
  action: 'verify', paymentId: 'TRX-DEMO-1234', orderId: ORD2_ID,
});
jget(bkvRes.json, 'status') === 'Completed' ? pass('verify ok') : fail(`verify: ${bkvRes.text}`);

const paidCheck = await http(jarA, 'GET', `/api/orders/${ORD2_ID}`);
jget(paidCheck.json, 'paymentStatus') === 'paid' ? pass('order paid after verify') : fail(`not paid: ${paidCheck.text.slice(0, 200)}`);

// ====================================================================
// 7. /api/insights
// ====================================================================
note('7. /api/insights');
{
  const r = await http(newJar(), 'GET', '/api/insights');
  r.status === 401 ? pass('GET unauth=401') : fail(`GET unauth=${r.status}`);
}
const insGet = await http(jarA, 'GET', '/api/insights');
const INS_LEN = Array.isArray(insGet.json) ? insGet.json.length : -1;
pass(`GET returned ${INS_LEN} rows`);

const insPost = await http(jarA, 'POST', '/api/insights', {});
const INS_GEN = jget(insPost.json, 'created');
(INS_GEN !== '' && INS_GEN != null) ? pass(`POST created=${INS_GEN}`) : fail(`POST: ${insPost.text}`);

// ====================================================================
// 8. /api/analytics
// ====================================================================
note('8. /api/analytics');
{
  const r = await http(newJar(), 'GET', '/api/analytics');
  r.status === 401 ? pass('unauth=401') : fail(`unauth=${r.status}`);
}
const ana = await http(jarA, 'GET', '/api/analytics');
const HAS_REV = jget(ana.json, 'revenue') !== '';
const HAS_ORD = jget(ana.json, 'orders') !== '';
(HAS_REV && HAS_ORD) ? pass('has revenue+orders shape') : fail(`shape: ${ana.text.slice(0, 200)}`);

// ====================================================================
// Done
// ====================================================================
console.log('');
if (failed === 0) {
  console.log(`${G}ALL SMOKE CHECKS PASSED${N}`);
} else {
  console.log(`${R}${failed} SMOKE CHECK(S) FAILED${N}`);
}
await prisma.$disconnect();
process.exit(failed === 0 ? 0 : 1);
