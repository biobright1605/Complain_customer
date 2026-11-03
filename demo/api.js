/**
 * ============================================================
 *  demo/api.js — "Back-End จำลอง" สำหรับเวอร์ชันทดลองบน GitHub Pages
 *  - ใช้แทน public/js/api.js ตอน build (scripts/build-pages-demo.mjs)
 *  - export ชื่อเดียวกับ api.js จริงทุกตัว หน้าจอจึงไม่ต้องแก้
 *  - เก็บข้อมูลใน localStorage ของเบราว์เซอร์ผู้ทดลองแต่ละคน (ไม่แชร์กัน)
 *  - กฎ workflow / สิทธิ์ ใช้ shared/workflow.js ชุดเดียวกับ server จริง
 *  - ไม่ส่งอีเมลจริง (บันทึกใน timeline ว่า "จะส่งถึงใคร" เท่านั้น)
 * ============================================================
 */
import {
  ROLES, MANAGER_POSITIONS as M, PRODUCTS, CATEGORIES, UNITS, SEVERITY, ALLOWED_MIME, EXPORT_COLUMNS, STATUS,
} from '/shared/constants.js';
import {
  ACTIONS, allowedActions, applyListFilter, canDo, canSeeQaResult, canView, complaintNoPrefix, DAY_MS,
  isEmail, mailRecipients, missingForReview, nextStatus, splitEmails,
} from '/shared/workflow.js';

const DB_KEY = 'srs-complaint-demo-db-v1';
const SESSION_KEY = 'srs-complaint-demo-session-v1';
const DEMO_PASSWORD = '1234';
const MAX_FILE_BYTES = 2 * 1024 * 1024; // localStorage จำกัดพื้นที่ — จำกัดไฟล์ละ 2 MB

/* ------------------------------------------------------------
 * Error (รูปแบบเดียวกับ api.js จริง)
 * ---------------------------------------------------------- */
export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}
const err = (status, message, data = {}) => new ApiError(status, message, { error: message, ...data });
const badRequest = (m) => err(400, m);
const unauthorized = (m = 'กรุณาเข้าสู่ระบบ') => err(401, m);
const forbidden = (m = 'ไม่มีสิทธิ์ทำรายการนี้') => err(403, m);
const notFound = (m = 'ไม่พบข้อมูล') => err(404, m);
const conflict = (m) => err(409, m);

/* ------------------------------------------------------------
 * ข้อมูลตัวอย่าง (ชุดเดียวกับ src/db/seed.js โหมด SEED_DEMO)
 * ---------------------------------------------------------- */
const DEMO_USERS = [
  { username: 'sales', name: 'สมชาย ใจดี', role: 'sales', position: 'ฝ่ายขาย', email: 'somchai.j@surinsugar.co.th' },
  { username: 'sales2', name: 'วรรณา ศรีสุข', role: 'sales', position: 'ฝ่ายขาย', email: 'wanna.s@surinsugar.co.th' },
  { username: 'qa', name: 'ปิยะพงษ์ แก้วมณี', role: 'qa', position: 'QA โรงงาน', email: 'qa@surinsugar.co.th' },
  { username: 'mgr', name: 'ธนากร บุญมา', role: 'mgr', position: M[0], email: 'production.mgr@surinsugar.co.th' },
  { username: 'mgr2', name: 'กิตติ พรหมสุวรรณ', role: 'mgr', position: M[1], email: 'warehouse.mgr@surinsugar.co.th' },
  { username: 'mgr3', name: 'สุภาพร วงศ์ไทย', role: 'mgr', position: M[2], email: 'purchasing.mgr@surinsugar.co.th' },
  { username: 'qmr', name: 'อรุณี ทองคำ', role: 'qmr', position: 'QMR', email: 'qmr@surinsugar.co.th' },
  { username: 'admin', name: 'ผู้ดูแลระบบ', role: 'admin', position: 'IT', email: 'it@surinsugar.co.th' },
];

const DEMO_MAIL = {
  qaEmail: 'qa@surinsugar.co.th',
  qmrEmail: 'qmr@surinsugar.co.th',
  mgrEmails: { [M[0]]: 'production.mgr@surinsugar.co.th', [M[1]]: 'warehouse.mgr@surinsugar.co.th', [M[2]]: 'purchasing.mgr@surinsugar.co.th' },
  ccAll: '',
};

const DEMO_COMPLAINTS = [
  { daysAgo: 0.2, status: 'new', sev: 'urgent', sales: 'sales', customer: 'บริษัท ขนมไทยสยาม จำกัด', contact: 'คุณมาลี 081-234-5678', invoice: 'IV6910-0452', product: 'น้ำตาลทรายขาวบริสุทธิ์', lot: 'RW691022-B3', qty: '20', unit: 'กระสอบ', category: 'สิ่งแปลกปลอม', customerWant: 'ตรวจสอบและเปลี่ยนสินค้า', detail: 'ลูกค้าพบเศษพลาสติกสีฟ้าขนาดประมาณ 5 มม. ปนในน้ำตาล 3 กระสอบ จากที่เปิดใช้ 20 กระสอบ' },
  { daysAgo: 8, status: 'ack', sev: 'high', sales: 'sales2', customer: 'โรงงานเครื่องดื่มอีสาน จำกัด', product: 'น้ำตาลทรายขาว', lot: 'RW691015-A1', qty: '2', unit: 'ตัน', pack: '1 ตัน/Jumbo bag', category: 'ความชื้น / จับตัวเป็นก้อน', customerWant: 'เปลี่ยนสินค้า', detail: 'น้ำตาลจับตัวเป็นก้อนแข็งทั้ง Jumbo bag ไม่สามารถป้อนเข้าเครื่องละลายได้' },
  { daysAgo: 5, status: 'inv', sev: 'normal', sales: 'sales', customer: 'ห้างหุ้นส่วนจำกัด เบเกอรี่โฮม', product: 'น้ำตาลไอซิ่ง', lot: 'IC691012-02', qty: '15', unit: 'ถุง', pack: '1 กก./ถุง', category: 'กลิ่น / รสผิดปกติ', detail: 'ลูกค้าแจ้งว่าน้ำตาลไอซิ่งมีกลิ่นอับคล้ายกระดาษเปียก พบใน 15 ถุงจากล็อตเดียวกัน', cause: 'อยู่ระหว่างตรวจตัวอย่างเก็บ (retained sample) ของ Lot เดียวกัน', managerPosition: M[1] },
  { daysAgo: 4, status: 'rev', sev: 'high', sales: 'sales2', customer: 'บริษัท สยามฟู้ดโปรดักส์ จำกัด', product: 'น้ำตาลทรายดิบ', lot: 'RR691008-C4', qty: '40', unit: 'กระสอบ', category: 'บรรจุภัณฑ์ชำรุด / ฉีกขาด', customerWant: 'เปลี่ยนสินค้า', detail: 'ตะเข็บปากกระสอบหลุดระหว่างขนส่ง น้ำตาลรั่วไหล 40 กระสอบ', managerPosition: M[0], cause: 'เข็มเย็บปากกระสอบของเครื่องเย็บไลน์ 2 สึกหรอ', action: 'เปลี่ยนเข็มและปรับตั้งเครื่องเย็บ ตรวจกระสอบในคลังของ Lot เดียวกัน', prevent: 'เพิ่มรายการตรวจเข็มเย็บใน checklist ประจำกะ', owner: 'หัวหน้าแผนกบรรจุ' },
  { daysAgo: 2.4, status: 'apr', sev: 'urgent', sales: 'sales', customer: 'บริษัท นมสดอีสาน จำกัด', product: 'น้ำตาลทรายขาวบริสุทธิ์', lot: 'RW691018-A2', qty: '500', unit: 'กิโลกรัม', category: 'ฉลาก / Lot ไม่ถูกต้อง', detail: 'Lot ที่พิมพ์บนกระสอบไม่ตรงกับใบ COA ที่ส่งมาพร้อมสินค้า', managerPosition: M[1], cause: 'พนักงานคลังหยิบใบ COA ของ Lot ก่อนหน้าแนบไปกับสินค้า', action: 'ออกใบ COA ที่ถูกต้องส่งให้ลูกค้าแล้ว', prevent: 'ให้ระบบพิมพ์ COA จาก Lot ที่สแกนตอนจ่ายสินค้า', review: 'กิตติ พรหมสุวรรณ (ผู้จัดการคลังสินค้า)' },
  { daysAgo: 15, status: 'done', sev: 'normal', sales: 'sales2', customer: 'ร้านขนมหวานบ้านสวน', product: 'น้ำตาลทรายแดง', lot: 'BR690930-01', qty: '10', unit: 'ถุง', pack: '1 กก./ถุง', category: 'สี / ความขาวผิดปกติ', detail: 'สีน้ำตาลเข้มกว่าปกติ ลูกค้ากังวลว่าเป็นสินค้าเก่า', managerPosition: M[0], cause: 'ค่าสีอยู่ในเกณฑ์มาตรฐาน แต่อยู่ช่วงบนของสเปก เนื่องจากอ้อยต้นฤดู', action: 'ชี้แจงลูกค้าพร้อมผลวิเคราะห์ค่าสี (ICUMSA)', prevent: 'แจ้งฝ่ายขายเรื่องช่วงสีตามฤดูกาลผลิตล่วงหน้า', review: 'ธนากร บุญมา (ผู้จัดการฝ่ายผลิต)', approval: 'อรุณี ทองคำ (QMR)' },
  { daysAgo: 10, status: 'cx', sev: 'high', sales: 'sales', customer: 'บริษัท ไอศกรีมสุรินทร์ จำกัด', product: 'น้ำตาลก้อน', lot: 'SC691001-05', qty: '8', unit: 'กล่อง', category: 'น้ำหนักไม่ครบ', detail: 'น้ำหนักต่อกล่องขาดประมาณ 200 กรัม', cancel: 'ลูกค้าชั่งใหม่แล้วครบตามจำนวน' },
];

/** ข้อมูลย้อนหลัง (ปิดเรื่องแล้ว) ให้กราฟมีข้อมูล — สุ่มแบบกำหนดค่าเริ่มต้นเหมือน seed.js */
function historyComplaints() {
  let r = 7;
  const rnd = () => ((r = (r * 16807) % 2147483647), r / 2147483647);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const customers = [...new Set(DEMO_COMPLAINTS.map((c) => c.customer))];
  const out = [];
  for (let t = new Date(2025, 0, 2).getTime(); t < new Date(2026, 9, 10).getTime(); t += DAY_MS) {
    if (rnd() > 0.1) continue;
    const cancelled = rnd() < 0.08;
    out.push({
      createdAt: new Date(t + (9 + Math.floor(rnd() * 7)) * 3_600_000),
      status: cancelled ? 'cx' : 'done',
      sev: pick(['urgent', 'high', 'normal']),
      sales: pick(['sales', 'sales2']),
      customer: pick(customers),
      product: pick(PRODUCTS.slice(0, 6)),
      lot: `L${Math.floor(rnd() * 1e6)}`,
      qty: String(1 + Math.floor(rnd() * 40)),
      unit: 'กระสอบ',
      category: pick(CATEGORIES.slice(0, 9)),
      detail: 'ข้อมูลย้อนหลัง',
      managerPosition: M[0],
      cause: cancelled ? '' : 'ตรวจสอบและแก้ไขแล้ว',
      approval: cancelled ? null : 'อรุณี ทองคำ (QMR)',
      cancel: cancelled ? 'ลูกค้าแจ้งยกเลิก' : null,
    });
  }
  return out;
}

/* ------------------------------------------------------------
 * "ฐานข้อมูล" ใน localStorage
 * ---------------------------------------------------------- */
const COMPLAINT_FIELDS = [
  'sev', 'customer', 'contact', 'invoice', 'deliveryDate', 'product', 'lot', 'productionDate', 'pack', 'qty', 'unit',
  'category', 'customerWant', 'detail', 'mailSales', 'mailCc', 'cause', 'action', 'prevent', 'owner', 'dueDate', 'verify',
  'managerPosition', 'status', 'reviewedBy', 'reviewedAt', 'reviewNote', 'approvedBy', 'approvedAt', 'approveNote',
  'cancelBy', 'cancelAt', 'cancelReason',
];

let db = null;
let memorySession = null; // กรณีเบราว์เซอร์ปิด localStorage

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function freshDb() {
  const d = { seq: { user: 0, complaint: 0, log: 0, attachment: 0 }, users: [], settings: { ...DEMO_MAIL }, complaints: [], logs: [], attachments: [] };
  const byName = {};
  for (const u of DEMO_USERS) {
    const row = { ...u, id: ++d.seq.user, password: DEMO_PASSWORD, active: true, mustChangePassword: false };
    d.users.push(row);
    byName[u.username] = row;
  }
  const all = [...historyComplaints(), ...DEMO_COMPLAINTS].map((c) => ({ ...c, createdAt: c.createdAt || new Date(Date.now() - c.daysAgo * DAY_MS) }));
  all.sort((a, b) => a.createdAt - b.createdAt);
  for (const c of all) {
    const sales = byName[c.sales];
    const created = c.createdAt.getTime();
    const later = (days) => created + days * DAY_MS;
    const { daysAgo, sales: _s, review, approval, cancel, createdAt: _c, ...fields } = c;
    const salesActor = `${sales.name} (ฝ่ายขาย)`;
    const id = insertComplaint(d, {
      pack: '50 กก./กระสอบ',
      mailSales: sales.email,
      ...fields,
      no: nextComplaintNo(d, complaintNoPrefix(c.createdAt)),
      createdAt: created,
      salesUserId: sales.id,
      ...(review ? { reviewedBy: review, reviewedAt: later(1), reviewNote: '' } : {}),
      ...(approval ? { approvedBy: approval, approvedAt: later(2), approveNote: 'อนุมัติ' } : {}),
      ...(cancel ? { cancelBy: salesActor, cancelAt: later(1), cancelReason: cancel } : {}),
    });
    insertLog(d, id, { at: created, by: salesActor, text: 'ส่งข้อร้องเรียนถึง QA' });
    if (cancel) insertLog(d, id, { at: later(1), by: salesActor, text: `ยกเลิกข้อร้องเรียน: ${cancel}` });
    if (approval) insertLog(d, id, { at: later(2), by: approval, text: 'อนุมัติ ปิดเรื่องและส่งผลให้ฝ่ายขาย' });
  }
  return d;
}

function load() {
  if (db) return db;
  try {
    const raw = storageGet(DB_KEY);
    db = raw ? JSON.parse(raw) : null;
  } catch {
    db = null;
  }
  if (!db || !Array.isArray(db.users)) {
    db = freshDb();
    save();
  }
  return db;
}

function save() {
  if (!storageSet(DB_KEY, JSON.stringify(db))) {
    // เต็ม (ไฟล์แนบเยอะ) — ข้อมูลยังอยู่ในหน่วยความจำจนกว่าจะปิดหน้า
    console.warn('[demo] บันทึกลง localStorage ไม่ได้ (พื้นที่เต็มหรือถูกปิด)');
  }
}

/** ล้างข้อมูลทดลองทั้งหมด (ใช้กับปุ่มบนแถบ Demo) */
export function resetDemo() {
  storageSet(DB_KEY, null);
  storageSet(SESSION_KEY, null);
  db = null;
  memorySession = null;
}
if (typeof window !== 'undefined') window.__resetDemo = resetDemo;

function insertComplaint(d, { no, createdAt, salesUserId, ...fields }) {
  const row = { id: ++d.seq.complaint, no, createdAt, salesUserId };
  for (const k of COMPLAINT_FIELDS) row[k] = fields[k] ?? null;
  d.complaints.push(row);
  return row.id;
}

function nextComplaintNo(d, prefix) {
  let last = 0;
  for (const c of d.complaints) {
    if (c.no.startsWith(`${prefix}-`)) last = Math.max(last, Number.parseInt(c.no.split('-').pop(), 10) || 0);
  }
  return `${prefix}-${String(last + 1).padStart(2, '0')}`;
}

function insertLog(d, complaintId, { at, by, text, isMail = false }) {
  d.logs.push({ id: ++d.seq.log, complaintId, at: +at, by, text, isMail });
}

/** แปลงแถว -> object ข้อร้องเรียน (รูปแบบเดียวกับ complaint-repo.toComplaint) */
function toComplaint(row) {
  const d = load();
  const sales = d.users.find((u) => u.id === row.salesUserId);
  const c = { id: row.id, no: row.no, createdAt: row.createdAt, salesUserId: row.salesUserId, salesName: sales?.name || '' };
  for (const k of COMPLAINT_FIELDS) c[k] = row[k] ?? '';
  c.review = row.reviewedBy ? { by: row.reviewedBy, at: row.reviewedAt, note: row.reviewNote || '' } : null;
  c.approval = row.approvedBy ? { by: row.approvedBy, at: row.approvedAt, note: row.approveNote || '' } : null;
  c.cancel = row.cancelBy ? { by: row.cancelBy, at: row.cancelAt, reason: row.cancelReason || '' } : null;
  for (const k of ['reviewedBy', 'reviewedAt', 'reviewNote', 'approvedBy', 'approvedAt', 'approveNote', 'cancelBy', 'cancelAt', 'cancelReason']) delete c[k];
  return c;
}

const findRow = (id) => load().complaints.find((c) => c.id === id) || null;
const findComplaint = (id) => {
  const r = findRow(id);
  return r ? toComplaint(r) : null;
};

const publicUser = (u) => ({
  id: u.id, username: u.username, name: u.name, email: u.email, role: u.role, position: u.position,
  active: !!u.active, mustChangePassword: !!u.mustChangePassword,
});

/* ------------------------------------------------------------
 * Session
 * ---------------------------------------------------------- */
function sessionUserId() {
  const v = storageGet(SESSION_KEY) ?? memorySession;
  return v ? Number(v) : null;
}
function setSession(id) {
  memorySession = id ? String(id) : null;
  storageSet(SESSION_KEY, memorySession);
}
function currentUser() {
  const id = sessionUserId();
  const u = id ? load().users.find((x) => x.id === id) : null;
  return u && u.active ? publicUser(u) : null;
}
/** เทียบเท่า middleware requireLogin */
function requireLogin() {
  const user = currentUser();
  if (!user) throw unauthorized();
  if (user.mustChangePassword) throw err(403, 'กรุณาเปลี่ยนรหัสผ่านก่อนใช้งาน', { code: 'PASSWORD_CHANGE_REQUIRED' });
  return user;
}
const requireRole = (user, ...roles) => {
  if (!roles.includes(user.role)) throw forbidden();
};

/* ------------------------------------------------------------
 * ตัวกลาง: ทำงานแบบ async + แจ้ง event เหมือน api.js จริง
 * ---------------------------------------------------------- */
async function handle(fn) {
  await new Promise((r) => setTimeout(r, 120)); // หน่วงเล็กน้อยให้เหมือนเรียก server
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 401) window.dispatchEvent(new CustomEvent('auth:expired'));
      if (e.data?.code === 'PASSWORD_CHANGE_REQUIRED') window.dispatchEvent(new CustomEvent('auth:change-password'));
      throw e;
    }
    console.error('[demo]', e);
    throw new ApiError(500, 'เกิดข้อผิดพลาดในระบบทดลอง', null);
  }
}

/* ------------------------------------------------------------
 * กฎธุรกิจ (พอร์ตจาก src/services/complaint-service.js)
 * ---------------------------------------------------------- */
const actorText = (user) => `${user.name} (${user.position || ROLES[user.role]})`;
const text = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const isDate = (v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v);
const QA_FIELDS = ['cause', 'action', 'prevent', 'owner', 'dueDate', 'verify', 'managerPosition'];

function redact(user, c) {
  if (canSeeQaResult(user, c)) return c;
  const hidden = { ...c, review: null, approval: null };
  for (const k of QA_FIELDS) hidden[k] = k === 'managerPosition' ? c.managerPosition : '';
  return hidden;
}

function listForUser(user) {
  const d = load();
  return d.complaints
    .filter((r) => user.role !== 'sales' || r.salesUserId === user.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((r) => redact(user, toComplaint(r)));
}

function queueMail(d, event, complaint, now) {
  const to = mailRecipients(event, complaint, d.settings);
  if (!to.length) return [];
  insertLog(d, complaint.id, { at: now, by: 'ระบบ', text: `ส่งอีเมลแจ้งอัตโนมัติถึง ${to.join(', ')} (โหมดทดลอง — ไม่ได้ส่งจริง)`, isMail: true });
  return to;
}

function validateNewComplaint(body) {
  const f = {
    customer: text(body.customer, 200), contact: text(body.contact, 200), invoice: text(body.invoice, 80),
    deliveryDate: text(body.deliveryDate, 10), product: text(body.product, 80), lot: text(body.lot, 80),
    productionDate: text(body.productionDate, 10), pack: text(body.pack, 80), qty: text(body.qty, 30),
    unit: text(body.unit, 30), category: text(body.category, 80), sev: text(body.sev, 10),
    customerWant: text(body.customerWant, 255), detail: text(body.detail, 5000), mailSales: text(body.mailSales, 160),
    mailCc: splitEmails(body.mailCc).join(', ').slice(0, 500),
  };
  const missing = [];
  if (!f.customer) missing.push('ชื่อลูกค้า');
  if (!PRODUCTS.includes(f.product)) missing.push('ชนิดสินค้า');
  if (!f.lot) missing.push('Lot / Batch No.');
  if (!f.qty) missing.push('จำนวนที่มีปัญหา');
  if (!CATEGORIES.includes(f.category)) missing.push('ประเภทปัญหา');
  if (!f.detail) missing.push('รายละเอียดปัญหา');
  if (missing.length) throw badRequest(`กรุณากรอก: ${missing.join(', ')}`);
  if (!UNITS.includes(f.unit)) throw badRequest('หน่วยไม่ถูกต้อง');
  if (!SEVERITY[f.sev]) throw badRequest('กำหนดตอบกลับไม่ถูกต้อง');
  if (!isDate(f.deliveryDate) || !isDate(f.productionDate)) throw badRequest('รูปแบบวันที่ไม่ถูกต้อง');
  const bad = [f.mailSales, ...splitEmails(f.mailCc)].filter((e) => e && !isEmail(e));
  if (bad.length) throw badRequest(`รูปแบบอีเมลไม่ถูกต้อง: ${bad.join(', ')}`);
  return f;
}

function pickQaFields(body) {
  const f = {
    cause: text(body.cause, 5000), action: text(body.action, 5000), prevent: text(body.prevent, 5000),
    owner: text(body.owner, 160), dueDate: text(body.dueDate, 10), verify: text(body.verify, 5000),
    managerPosition: text(body.managerPosition, 80),
  };
  if (!isDate(f.dueDate)) throw badRequest('รูปแบบกำหนดเสร็จไม่ถูกต้อง');
  if (f.managerPosition && !M.includes(f.managerPosition)) throw badRequest('ตำแหน่งผู้จัดการไม่ถูกต้อง');
  return f;
}

const countQaFiles = (id) => load().attachments.filter((a) => a.complaintId === id && a.kind === 'qa').length;

const HANDLERS = {
  ack: () => ({ fields: {}, log: 'รับเรื่องแล้ว', okMessage: 'รับเรื่องแล้ว' }),
  saveQa: ({ c, body }) => ({
    fields: pickQaFields(body),
    log: c.status === 'inv' ? 'บันทึกผลการตรวจสอบ' : 'เริ่มตรวจสอบ · บันทึกผล',
    okMessage: 'บันทึกร่างแล้ว',
  }),
  submitReview: ({ c, body }) => {
    const fields = pickQaFields(body);
    const missing = missingForReview(fields, countQaFiles(c.id));
    if (missing.length) throw badRequest(`ก่อนส่งทบทวน กรุณาระบุ: ${missing.join(', ')}`);
    return { fields, log: `ส่งให้ ${fields.managerPosition} ทบทวน`, okMessage: `ส่งให้ ${fields.managerPosition} ทบทวนแล้ว` };
  },
  review: ({ user, note, now }) => ({
    fields: { reviewedBy: actorText(user), reviewedAt: now, reviewNote: note },
    log: `ทบทวนแล้ว ส่งให้ QMR${note ? ` · ${note}` : ''}`,
    okMessage: 'ส่งให้ QMR อนุมัติแล้ว',
  }),
  sendBack: ({ note }) => ({
    fields: { reviewedBy: null, reviewedAt: null, reviewNote: null },
    log: `ส่งกลับ QA แก้ไข: ${note}`,
    okMessage: 'ส่งกลับ QA แล้ว',
  }),
  approve: ({ user, note, now }) => ({
    fields: { approvedBy: actorText(user), approvedAt: now, approveNote: note },
    log: `อนุมัติ ปิดเรื่องและส่งผลให้ฝ่ายขาย${note ? ` · ${note}` : ''}`,
    okMessage: 'อนุมัติและปิดเรื่องแล้ว',
  }),
  reject: ({ note }) => ({
    fields: { reviewedBy: null, reviewedAt: null, reviewNote: null, approvedBy: null, approvedAt: null, approveNote: null },
    log: `ไม่อนุมัติ ส่งกลับ QA: ${note}`,
    okMessage: 'ส่งกลับ QA แล้ว',
  }),
  cancel: ({ user, note, now }) => ({
    fields: { cancelBy: actorText(user), cancelAt: now, cancelReason: note },
    log: `ยกเลิกข้อร้องเรียน: ${note}`,
    okMessage: 'ยกเลิกข้อร้องเรียนแล้ว',
  }),
  note: ({ note }) => {
    if (!note) throw badRequest('กรุณาพิมพ์ข้อความก่อน');
    return { fields: {}, log: note, okMessage: 'เพิ่มบันทึกแล้ว' };
  },
};

const REASON_REQUIRED = {
  sendBack: 'กรุณาระบุเหตุผลที่ส่งกลับ',
  reject: 'กรุณาระบุเหตุผลที่ไม่อนุมัติ',
  cancel: 'กรุณาระบุเหตุผลที่ยกเลิก',
};

/* ------------------------------------------------------------
 * ไฟล์แนบ: อ่านเป็น data URL เก็บใน localStorage
 * ---------------------------------------------------------- */
function filesFrom(formData) {
  return formData instanceof FormData ? formData.getAll('files').filter((f) => f instanceof File && f.size > 0) : [];
}

async function readFiles(files) {
  if (files.length > 10) throw badRequest('แนบได้ครั้งละไม่เกิน 10 ไฟล์');
  for (const f of files) {
    if (!ALLOWED_MIME.includes(f.type)) throw badRequest(`ไม่รองรับไฟล์ชนิดนี้: ${f.name} (รองรับเฉพาะรูปภาพและ PDF)`);
    if (f.size > MAX_FILE_BYTES) throw badRequest(`ไฟล์ ${f.name} ใหญ่เกินไป (เวอร์ชันทดลองรับไม่เกิน 2 MB ต่อไฟล์)`);
  }
  return Promise.all(files.map((f) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ filename: f.name.slice(0, 255), mime: f.type, size: f.size, dataUrl: r.result });
    r.onerror = () => reject(badRequest(`อ่านไฟล์ ${f.name} ไม่สำเร็จ`));
    r.readAsDataURL(f);
  })));
}

const blobUrls = new Map();
function attachmentBlobUrl(a) {
  if (!blobUrls.has(a.id)) {
    const [head, b64] = a.dataUrl.split(',');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    blobUrls.set(a.id, URL.createObjectURL(new Blob([bytes], { type: head.slice(5).split(';')[0] })));
  }
  return blobUrls.get(a.id);
}

/** ตัวอย่างรูปว่าง (ไฟล์ไม่พบ/ไม่มีสิทธิ์) */
const EMPTY_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

/* ------------------------------------------------------------
 * ส่งออก CSV (เวอร์ชันทดลองส่งออกเป็น CSV ทั้งสองแบบ)
 * ---------------------------------------------------------- */
const p2 = (n) => String(n).padStart(2, '0');
const fmtDateTime = (ms) => {
  const d = new Date(ms);
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
function cellValue(c, key) {
  if (key === 'createdAt') return fmtDateTime(c.createdAt);
  if (key === 'status') return STATUS[c.status];
  if (key === 'sev') return SEVERITY[c.sev];
  return c[key] ?? '';
}
function downloadCsv(user, filter) {
  const list = applyListFilter(listForUser(user), filter);
  const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [EXPORT_COLUMNS.map(([, h]) => h), ...list.map((c) => EXPORT_COLUMNS.map(([k]) => cellValue(c, k)))]
    .map((r) => r.map(quote).join(','));
  const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const now = new Date();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sugar-complaints-${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/* ------------------------------------------------------------
 * ผู้ใช้ (พอร์ตจาก src/services/user-service.js)
 * ---------------------------------------------------------- */
function temporaryPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => chars[b % chars.length]).join('');
}
function resolvePosition(role, position) {
  if (role === 'mgr') {
    if (!M.includes(position)) throw badRequest('กรุณาเลือกตำแหน่งผู้จัดการ');
    return position;
  }
  return ROLES[role];
}
const findUserRow = (id) => load().users.find((u) => u.id === Number(id)) || null;

/* ============================================================
 *  API (ชื่อ/รูปแบบเดียวกับ public/js/api.js)
 * ============================================================ */
export const auth = {
  me: () => handle(() => ({ user: currentUser() })),

  login: (username, password) => handle(() => {
    const u = load().users.find((x) => x.username === String(username || '').trim().toLowerCase());
    if (!u || u.password !== String(password || '')) throw unauthorized('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    if (!u.active) throw forbidden('บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบหรือ QA');
    setSession(u.id);
    return { user: publicUser(u) };
  }),

  logout: () => handle(() => {
    setSession(null);
    return { ok: true };
  }),

  changePassword: (currentPassword, newPassword) => handle(() => {
    const user = currentUser();
    if (!user) throw unauthorized();
    const row = findUserRow(user.id);
    if (row.password !== String(currentPassword || '')) throw badRequest('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    const next = String(newPassword || '');
    if (next.length < 8) throw badRequest('รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร');
    if (next === currentPassword) throw badRequest('รหัสผ่านใหม่ต้องไม่ซ้ำรหัสเดิม');
    row.password = next;
    row.mustChangePassword = false;
    save();
    return { ok: true, message: 'เปลี่ยนรหัสผ่านแล้ว' };
  }),
};

export const complaints = {
  list: () => handle(() => ({ items: listForUser(requireLogin()) })),

  get: (id) => handle(() => {
    const user = requireLogin();
    const c = findComplaint(Number(id));
    if (!c || !canView(user, c)) throw notFound('ไม่พบข้อร้องเรียน');
    const showQa = canSeeQaResult(user, c);
    const attachments = load().attachments
      .filter((a) => a.complaintId === c.id && (a.kind === 'sales' || showQa))
      .sort((a, b) => a.uploadedAt - b.uploadedAt || a.id - b.id)
      .map(({ dataUrl, ...rest }) => rest);
    const logs = load().logs
      .filter((l) => l.complaintId === c.id)
      .sort((a, b) => b.at - a.at || b.id - a.id)
      .map(({ at, by, text: t, isMail }) => ({ at, by, text: t, isMail }));
    return { ...redact(user, c), attachments, logs, actions: allowedActions(user, c) };
  }),

  create: (formData) => handle(async () => {
    const user = requireLogin();
    if (user.role !== 'sales') throw forbidden('เฉพาะฝ่ายขายเท่านั้นที่แจ้งข้อร้องเรียนได้');
    const body = formData instanceof FormData ? Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === 'string')) : formData || {};
    const fields = validateNewComplaint(body);
    if (!fields.mailSales) fields.mailSales = user.email;
    const files = await readFiles(filesFrom(formData));

    const d = load();
    const now = Date.now();
    const no = nextComplaintNo(d, complaintNoPrefix(new Date(now)));
    const id = insertComplaint(d, { ...fields, no, createdAt: now, salesUserId: user.id, status: 'new' });
    for (const f of files) d.attachments.push({ ...f, id: ++d.seq.attachment, complaintId: id, kind: 'sales', uploadedBy: actorText(user), uploadedAt: now });
    insertLog(d, id, { at: now, by: actorText(user), text: 'ส่งข้อร้องเรียนถึง QA' });
    const mailedTo = queueMail(d, 'new', findComplaint(id), now);
    save();
    return { id, no, mailedTo };
  }),

  action: (id, name, body = {}) => handle(() => {
    const user = requireLogin();
    const def = ACTIONS[name];
    const handler = HANDLERS[name];
    if (!def || !handler || name === 'qaFile') throw badRequest('action ไม่ถูกต้อง');
    const note = text(body.note, 2000);
    if (def.needReason && !note) throw badRequest(REASON_REQUIRED[name]);

    const row = findRow(Number(id));
    const c = row ? toComplaint(row) : null;
    if (!c || !canView(user, c)) throw notFound('ไม่พบข้อร้องเรียน');
    if (!canDo(user, c, name)) throw forbidden('ไม่สามารถทำรายการนี้ได้ในสถานะปัจจุบัน หรือไม่มีสิทธิ์');

    const now = Date.now();
    const out = handler({ user, c, body, note, now });
    const status = nextStatus(c, name);
    for (const [k, v] of Object.entries({ ...out.fields, status })) {
      if (COMPLAINT_FIELDS.includes(k)) row[k] = v === '' && (k.endsWith('Date') || k.endsWith('At')) ? null : v;
    }
    const d = load();
    insertLog(d, row.id, { at: now, by: actorText(user), text: out.log });
    const mailedTo = def.mail ? queueMail(d, def.mail, toComplaint(row), now) : [];
    save();
    return { status, message: out.okMessage, mailedTo };
  }),

  uploadQaFiles: (id, formData) => handle(async () => {
    const user = requireLogin();
    const files = filesFrom(formData);
    if (!files.length) throw badRequest('กรุณาเลือกไฟล์');
    const c = findComplaint(Number(id));
    if (!c || !canDo(user, c, 'qaFile')) throw forbidden();
    const records = await readFiles(files);
    const d = load();
    const now = Date.now();
    for (const r of records) d.attachments.push({ ...r, id: ++d.seq.attachment, complaintId: c.id, kind: 'qa', uploadedBy: actorText(user), uploadedAt: now });
    insertLog(d, c.id, { at: now, by: actorText(user), text: `แนบหลักฐาน: ${records.map((r) => r.filename).join(', ')}` });
    save();
    return { ok: true, message: 'แนบหลักฐานแล้ว' };
  }),

  deleteAttachment: (attachmentId) => handle(() => {
    const user = requireLogin();
    const d = load();
    const a = d.attachments.find((x) => x.id === Number(attachmentId));
    if (!a || a.kind !== 'qa') throw notFound('ไม่พบไฟล์');
    const c = findComplaint(a.complaintId);
    if (!c || !canDo(user, c, 'qaFile')) throw forbidden();
    d.attachments = d.attachments.filter((x) => x.id !== a.id);
    insertLog(d, c.id, { at: Date.now(), by: actorText(user), text: `ลบไฟล์แนบ: ${a.filename}` });
    save();
    return { ok: true, message: 'ลบไฟล์แล้ว' };
  }),

  /** คืน blob URL ของไฟล์ (ตรวจสิทธิ์แบบเดียวกับ server) */
  attachmentUrl: (attachmentId) => {
    const user = currentUser();
    const a = load().attachments.find((x) => x.id === Number(attachmentId));
    const c = a && findComplaint(a.complaintId);
    if (!user || !a || !c || !canView(user, c) || (a.kind === 'qa' && !canSeeQaResult(user, c))) return EMPTY_IMG;
    return attachmentBlobUrl(a);
  },

  /** ดาวน์โหลดทันที แล้วคืน URL ปัจจุบัน (หน้าจอจึงไม่เปลี่ยน) */
  exportUrl: (format, { filter, q }) => {
    const user = currentUser();
    if (user) downloadCsv(user, { filter: String(filter || 'all'), q: String(q || '') });
    return location.href;
  },
};

export const admin = {
  getMail: () => handle(() => {
    requireRole(requireLogin(), 'admin', 'qa', 'qmr');
    const s = load().settings;
    return { qaEmail: s.qaEmail || '', qmrEmail: s.qmrEmail || '', mgrEmails: { ...(s.mgrEmails || {}) }, ccAll: s.ccAll || '' };
  }),

  saveMail: (body = {}) => handle(() => {
    requireRole(requireLogin(), 'admin', 'qa', 'qmr');
    const clean = (v) => String(v || '').trim();
    const s = {
      qaEmail: clean(body.qaEmail),
      qmrEmail: clean(body.qmrEmail),
      mgrEmails: Object.fromEntries(M.map((p) => [p, clean(body.mgrEmails?.[p])])),
      ccAll: splitEmails(body.ccAll).join(', '),
    };
    const bad = [s.qaEmail, s.qmrEmail, ...Object.values(s.mgrEmails), ...splitEmails(s.ccAll)].filter((e) => e && !isEmail(e));
    if (bad.length) throw badRequest(`รูปแบบอีเมลไม่ถูกต้อง: ${bad.join(', ')}`);
    load().settings = s;
    save();
    return { ok: true, message: 'บันทึกการตั้งค่าอีเมลแล้ว' };
  }),

  listUsers: () => handle(() => {
    requireRole(requireLogin(), 'admin', 'qa', 'qmr');
    const items = [...load().users]
      .sort((a, b) => a.role.localeCompare(b.role) || a.username.localeCompare(b.username))
      .map(publicUser);
    return { items };
  }),

  createUser: ({ username, name, email, role, position } = {}) => handle(() => {
    requireRole(requireLogin(), 'admin', 'qa');
    const u = String(username || '').trim().toLowerCase();
    const n = String(name || '').trim();
    const e = String(email || '').trim();
    if (!u || !n || !e) throw badRequest('กรุณากรอกชื่อผู้ใช้ ชื่อ-นามสกุล และอีเมล');
    if (!/^[a-z0-9._-]{3,50}$/.test(u)) throw badRequest('ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - (3–50 ตัว)');
    if (!isEmail(e)) throw badRequest(`รูปแบบอีเมลไม่ถูกต้อง: ${e}`);
    if (!ROLES[role]) throw badRequest('บทบาทไม่ถูกต้อง');
    const d = load();
    if (d.users.some((x) => x.username === u)) throw conflict(`ชื่อผู้ใช้ ${u} มีอยู่แล้ว`);
    const tempPassword = temporaryPassword();
    const id = ++d.seq.user;
    d.users.push({ id, username: u, name: n, email: e, role, position: resolvePosition(role, position), password: tempPassword, active: true, mustChangePassword: true });
    save();
    return { id, tempPassword };
  }),

  updateUser: (id, { role, position, active } = {}) => handle(() => {
    const actor = requireLogin();
    requireRole(actor, 'admin', 'qa');
    const targetId = Number(id);
    if (actor.id === targetId) throw forbidden('แก้ไขสิทธิ์บัญชีของตัวเองไม่ได้');
    const target = findUserRow(targetId);
    if (!target) throw notFound('ไม่พบผู้ใช้');
    if (role !== undefined) {
      if (!ROLES[role]) throw badRequest('บทบาทไม่ถูกต้อง');
      const pos = resolvePosition(role, position ?? target.position);
      target.role = role;
      target.position = pos;
    } else if (position !== undefined && target.role === 'mgr') {
      target.position = resolvePosition('mgr', position);
    }
    if (active !== undefined) target.active = !!active;
    save();
    return { ok: true };
  }),

  resetPassword: (id) => handle(() => {
    const actor = requireLogin();
    requireRole(actor, 'admin', 'qa');
    const targetId = Number(id);
    if (actor.id === targetId) throw forbidden('ใช้เมนูเปลี่ยนรหัสผ่านสำหรับบัญชีของตัวเอง');
    const target = findUserRow(targetId);
    if (!target) throw notFound('ไม่พบผู้ใช้');
    const tempPassword = temporaryPassword();
    target.password = tempPassword;
    target.mustChangePassword = true;
    save();
    return { tempPassword };
  }),
};
