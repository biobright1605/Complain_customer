/**
 * ============================================================
 *  tests/e2e/smoke-test.mjs — ทดสอบ workflow ครบทุกบทบาทผ่าน API จริง
 *  ต้องรันระบบในโหมดทดลองก่อน (SEED_DEMO=true, รหัส 1234)
 *  รัน:  node tests/e2e/smoke-test.mjs            (ค่าเริ่มต้น http://localhost:3000)
 *        BASE_URL=http://192.168.20.254:3000 node tests/e2e/smoke-test.mjs
 *  หมายเหตุ: สคริปต์นี้สร้างข้อมูลจริงในฐานข้อมูล — ห้ามรันกับ production
 * ============================================================
 */
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PASSWORD = '1234';
let passed = 0;

/** client ที่จำ cookie session ของผู้ใช้แต่ละคน */
async function loginAs(username) {
  let cookie = '';
  const call = async (method, path, body, { ajax = true } = {}) => {
    const isForm = body instanceof FormData;
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(ajax ? { 'X-Requested-With': 'fetch' } : {}),
        ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const type = res.headers.get('content-type') || '';
    return { status: res.status, type, data: type.includes('json') ? await res.json() : await res.arrayBuffer() };
  };
  const res = await call('POST', '/api/auth/login', { username, password: PASSWORD });
  assert.equal(res.status, 200, `login ${username}: ${JSON.stringify(res.data)}`);
  return call;
}

async function step(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ✔ ${name}`);
}

const pngFile = (name) => new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], name, { type: 'image/png' });

/* ------------------------------------------------------------ */
console.log(`Smoke test → ${BASE}`);
const sales = await loginAs('sales');
const sales2 = await loginAs('sales2');
const qa = await loginAs('qa');
const mgrProd = await loginAs('mgr');
const mgrWh = await loginAs('mgr2');
const qmr = await loginAs('qmr');
const admin = await loginAs('admin');
let id;

await step('รหัสผ่านผิด -> 401', async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    body: JSON.stringify({ username: 'sales', password: 'wrong' }),
  });
  assert.equal(res.status, 401);
});

await step('ป้องกัน CSRF: POST ไม่มี header -> 403', async () => {
  const res = await sales('POST', '/api/complaints/1/actions/note', { note: 'x' }, { ajax: false });
  assert.equal(res.status, 403);
});

await step('ฝ่ายขายแจ้งเรื่องใหม่ + แนบรูป ภาษาไทย', async () => {
  const form = new FormData();
  Object.entries({
    customer: 'บริษัท ทดสอบระบบ จำกัด', product: 'น้ำตาลทรายขาว', lot: 'SMOKE-01', qty: '3', unit: 'กระสอบ',
    category: 'สิ่งแปลกปลอม', sev: 'urgent', detail: 'ทดสอบอัตโนมัติ', mailSales: 'somchai.j@surinsugar.co.th', mailCc: 'cc@surinsugar.co.th',
  }).forEach(([k, v]) => form.append(k, v));
  form.append('files', pngFile('หลักฐาน.png'));
  const res = await sales('POST', '/api/complaints', form);
  assert.equal(res.status, 201, JSON.stringify(res.data));
  assert.match(res.data.no, /^SC-\d{6}-\d{2}$/);
  assert.ok(res.data.mailedTo.includes('qa@surinsugar.co.th'));
  id = res.data.id;
});

await step('ฝ่ายขายคนอื่นมองไม่เห็นเรื่องนี้ -> 404', async () => {
  assert.equal((await sales2('GET', `/api/complaints/${id}`)).status, 404);
});

await step('QA รับเรื่อง -> ack', async () => {
  const res = await qa('POST', `/api/complaints/${id}/actions/ack`);
  assert.equal(res.data.status, 'ack');
});

const qaResult = { managerPosition: 'ผู้จัดการคลังสินค้า', cause: 'สาเหตุทดสอบ', action: 'แก้ไขแล้ว', prevent: 'ป้องกันแล้ว' };

await step('QA ส่งทบทวนโดยยังไม่แนบหลักฐาน -> 400', async () => {
  const res = await qa('POST', `/api/complaints/${id}/actions/submitReview`, qaResult);
  assert.equal(res.status, 400);
  assert.match(res.data.error, /หลักฐาน/);
});

await step('QA แนบหลักฐาน + ส่งทบทวน -> rev', async () => {
  const form = new FormData();
  form.append('files', pngFile('fix.png'));
  assert.equal((await qa('POST', `/api/complaints/${id}/files`, form)).status, 201);
  const res = await qa('POST', `/api/complaints/${id}/actions/submitReview`, qaResult);
  assert.equal(res.data.status, 'rev', JSON.stringify(res.data));
});

await step('ฝ่ายขายยังไม่เห็นผล QA ก่อนปิดเรื่อง', async () => {
  const { data } = await sales('GET', `/api/complaints/${id}`);
  assert.equal(data.cause, '');
  assert.ok(data.attachments.every((a) => a.kind === 'sales'));
});

await step('ผู้จัดการคนละตำแหน่งทบทวนไม่ได้ -> 403', async () => {
  assert.equal((await mgrProd('POST', `/api/complaints/${id}/actions/review`, {})).status, 403);
});

await step('ผู้จัดการคลังสินค้าทบทวน -> apr', async () => {
  const res = await mgrWh('POST', `/api/complaints/${id}/actions/review`, { note: 'เห็นด้วย' });
  assert.equal(res.data.status, 'apr');
});

await step('QMR ไม่อนุมัติโดยไม่ใส่เหตุผล -> 400', async () => {
  assert.equal((await qmr('POST', `/api/complaints/${id}/actions/reject`, {})).status, 400);
});

await step('QMR อนุมัติ -> done', async () => {
  const res = await qmr('POST', `/api/complaints/${id}/actions/approve`, { note: 'อนุมัติ' });
  assert.equal(res.data.status, 'done');
});

await step('ปิดเรื่องแล้ว ฝ่ายขายเห็นผล QA + timeline ครบ', async () => {
  const { data } = await sales('GET', `/api/complaints/${id}`);
  assert.equal(data.cause, 'สาเหตุทดสอบ');
  assert.ok(data.review.by.includes('กิตติ'));
  assert.ok(data.approval.by.includes('อรุณี'));
  assert.ok(data.logs.some((l) => l.isMail));
  assert.ok(data.attachments.some((a) => a.kind === 'qa'));
});

await step('ยกเลิกเรื่องที่ปิดแล้วไม่ได้ -> 403', async () => {
  assert.equal((await sales('POST', `/api/complaints/${id}/actions/cancel`, { note: 'x' })).status, 403);
});

await step('ส่งออก Excel และ CSV', async () => {
  const xlsx = await qa('GET', '/api/complaints/export?format=xlsx&filter=done&q=SMOKE');
  assert.equal(xlsx.status, 200);
  assert.match(xlsx.type, /spreadsheetml/);
  const csv = await qa('GET', '/api/complaints/export?format=csv&filter=all&q=SMOKE-01');
  const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(csv.data); // เก็บ BOM ไว้ตรวจ
  assert.ok(text.startsWith('﻿"เลขที่"'));
  assert.ok(text.includes('SMOKE-01'));
});

await step('ฝ่ายขายเข้าหน้าผู้ใช้ไม่ได้ / admin เพิ่มผู้ใช้ได้', async () => {
  assert.equal((await sales('GET', '/api/users')).status, 403);
  const name = `smoke${Date.now().toString().slice(-6)}`;
  const res = await admin('POST', '/api/users', { username: name, name: 'ทดสอบ', email: `${name}@surinsugar.co.th`, role: 'sales' });
  assert.equal(res.status, 201);
  assert.equal(res.data.tempPassword.length, 10);
});

await step('admin แก้สิทธิ์ตัวเองไม่ได้ -> 403', async () => {
  const { data } = await admin('GET', '/api/auth/me');
  assert.equal((await admin('PATCH', `/api/users/${data.user.id}`, { role: 'sales' })).status, 403);
});

console.log(`\nผ่านทั้งหมด ${passed} ขั้นตอน`);
