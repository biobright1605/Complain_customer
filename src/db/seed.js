/**
 * ============================================================
 *  db/seed.js — ข้อมูลเริ่มต้น (ทำงานเฉพาะเมื่อยังไม่มีผู้ใช้ในระบบ)
 *   - SEED_DEMO=false (production): สร้างบัญชี admin 1 บัญชี (บังคับเปลี่ยนรหัส)
 *   - SEED_DEMO=true  (ทดสอบ)     : บัญชีทดลอง 8 บัญชี รหัส 1234 + ข้อร้องเรียนตัวอย่าง
 *  รันตรง: npm run db:seed
 * ============================================================
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/env.js';
import { pool, withTransaction } from './pool.js';
import * as userRepo from '../repositories/user-repo.js';
import * as settingsRepo from '../repositories/settings-repo.js';
import * as complaintRepo from '../repositories/complaint-repo.js';
import { hashPassword } from '../services/user-service.js';
import { MANAGER_POSITIONS as M, PRODUCTS, CATEGORIES } from '../../shared/constants.js';
import { complaintNoPrefix, DAY_MS } from '../../shared/workflow.js';

// ---------- บัญชีทดลอง (โดเมนอีเมลเป็นค่าสมมติ — เปลี่ยนก่อนใช้งานจริง) ----------
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

/* ------------------------------------------------------------
 * ข้อร้องเรียนตัวอย่าง (ครอบคลุมทุกสถานะ)
 * daysAgo = แจ้งมาแล้วกี่วัน, sales = username ผู้แจ้ง
 * ---------------------------------------------------------- */
const DEMO_COMPLAINTS = [
  { daysAgo: 0.2, status: 'new', sev: 'urgent', sales: 'sales', customer: 'บริษัท ขนมไทยสยาม จำกัด', contact: 'คุณมาลี 081-234-5678', invoice: 'IV6910-0452', product: 'น้ำตาลทรายขาวบริสุทธิ์', lot: 'RW691022-B3', qty: '20', unit: 'กระสอบ', category: 'สิ่งแปลกปลอม', customerWant: 'ตรวจสอบและเปลี่ยนสินค้า', detail: 'ลูกค้าพบเศษพลาสติกสีฟ้าขนาดประมาณ 5 มม. ปนในน้ำตาล 3 กระสอบ จากที่เปิดใช้ 20 กระสอบ' },
  { daysAgo: 8, status: 'ack', sev: 'high', sales: 'sales2', customer: 'โรงงานเครื่องดื่มอีสาน จำกัด', product: 'น้ำตาลทรายขาว', lot: 'RW691015-A1', qty: '2', unit: 'ตัน', pack: '1 ตัน/Jumbo bag', category: 'ความชื้น / จับตัวเป็นก้อน', customerWant: 'เปลี่ยนสินค้า', detail: 'น้ำตาลจับตัวเป็นก้อนแข็งทั้ง Jumbo bag ไม่สามารถป้อนเข้าเครื่องละลายได้' },
  { daysAgo: 5, status: 'inv', sev: 'normal', sales: 'sales', customer: 'ห้างหุ้นส่วนจำกัด เบเกอรี่โฮม', product: 'น้ำตาลไอซิ่ง', lot: 'IC691012-02', qty: '15', unit: 'ถุง', pack: '1 กก./ถุง', category: 'กลิ่น / รสผิดปกติ', detail: 'ลูกค้าแจ้งว่าน้ำตาลไอซิ่งมีกลิ่นอับคล้ายกระดาษเปียก พบใน 15 ถุงจากล็อตเดียวกัน', cause: 'อยู่ระหว่างตรวจตัวอย่างเก็บ (retained sample) ของ Lot เดียวกัน', managerPosition: M[1] },
  { daysAgo: 4, status: 'rev', sev: 'high', sales: 'sales2', customer: 'บริษัท สยามฟู้ดโปรดักส์ จำกัด', product: 'น้ำตาลทรายดิบ', lot: 'RR691008-C4', qty: '40', unit: 'กระสอบ', category: 'บรรจุภัณฑ์ชำรุด / ฉีกขาด', customerWant: 'เปลี่ยนสินค้า', detail: 'ตะเข็บปากกระสอบหลุดระหว่างขนส่ง น้ำตาลรั่วไหล 40 กระสอบ', managerPosition: M[0], cause: 'เข็มเย็บปากกระสอบของเครื่องเย็บไลน์ 2 สึกหรอ', action: 'เปลี่ยนเข็มและปรับตั้งเครื่องเย็บ ตรวจกระสอบในคลังของ Lot เดียวกัน', prevent: 'เพิ่มรายการตรวจเข็มเย็บใน checklist ประจำกะ', owner: 'หัวหน้าแผนกบรรจุ' },
  { daysAgo: 2.4, status: 'apr', sev: 'urgent', sales: 'sales', customer: 'บริษัท นมสดอีสาน จำกัด', product: 'น้ำตาลทรายขาวบริสุทธิ์', lot: 'RW691018-A2', qty: '500', unit: 'กิโลกรัม', category: 'ฉลาก / Lot ไม่ถูกต้อง', detail: 'Lot ที่พิมพ์บนกระสอบไม่ตรงกับใบ COA ที่ส่งมาพร้อมสินค้า', managerPosition: M[1], cause: 'พนักงานคลังหยิบใบ COA ของ Lot ก่อนหน้าแนบไปกับสินค้า', action: 'ออกใบ COA ที่ถูกต้องส่งให้ลูกค้าแล้ว', prevent: 'ให้ระบบพิมพ์ COA จาก Lot ที่สแกนตอนจ่ายสินค้า', review: 'กิตติ พรหมสุวรรณ (ผู้จัดการคลังสินค้า)' },
  { daysAgo: 15, status: 'done', sev: 'normal', sales: 'sales2', customer: 'ร้านขนมหวานบ้านสวน', product: 'น้ำตาลทรายแดง', lot: 'BR690930-01', qty: '10', unit: 'ถุง', pack: '1 กก./ถุง', category: 'สี / ความขาวผิดปกติ', detail: 'สีน้ำตาลเข้มกว่าปกติ ลูกค้ากังวลว่าเป็นสินค้าเก่า', managerPosition: M[0], cause: 'ค่าสีอยู่ในเกณฑ์มาตรฐาน แต่อยู่ช่วงบนของสเปก เนื่องจากอ้อยต้นฤดู', action: 'ชี้แจงลูกค้าพร้อมผลวิเคราะห์ค่าสี (ICUMSA)', prevent: 'แจ้งฝ่ายขายเรื่องช่วงสีตามฤดูกาลผลิตล่วงหน้า', review: 'ธนากร บุญมา (ผู้จัดการฝ่ายผลิต)', approval: 'อรุณี ทองคำ (QMR)' },
  { daysAgo: 10, status: 'cx', sev: 'high', sales: 'sales', customer: 'บริษัท ไอศกรีมสุรินทร์ จำกัด', product: 'น้ำตาลก้อน', lot: 'SC691001-05', qty: '8', unit: 'กล่อง', category: 'น้ำหนักไม่ครบ', detail: 'น้ำหนักต่อกล่องขาดประมาณ 200 กรัม', cancel: 'ลูกค้าชั่งใหม่แล้วครบตามจำนวน' },
];

/** ข้อมูลย้อนหลัง (ปิดเรื่องแล้ว) สำหรับให้กราฟ dashboard มีข้อมูล — สุ่มแบบกำหนดค่าเริ่มต้น */
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

/** บันทึกข้อร้องเรียนตัวอย่าง 1 เรื่อง พร้อม log */
async function insertDemoComplaint(conn, c, usersByName) {
  const createdAt = c.createdAt || new Date(Date.now() - c.daysAgo * DAY_MS);
  const sales = usersByName[c.sales];
  const { daysAgo, sales: _s, review, approval, cancel, createdAt: _c, ...fields } = c;
  const later = (days) => new Date(createdAt.getTime() + days * DAY_MS);

  const no = await complaintRepo.nextComplaintNo(conn, complaintNoPrefix(createdAt));
  const id = await complaintRepo.insertComplaint(conn, {
    pack: '50 กก./กระสอบ',
    mailSales: sales.email,
    ...fields,
    no,
    createdAt,
    salesUserId: sales.id,
    ...(review ? { reviewedBy: review, reviewedAt: later(1), reviewNote: '' } : {}),
    ...(approval ? { approvedBy: approval, approvedAt: later(2), approveNote: 'อนุมัติ' } : {}),
    ...(cancel ? { cancelBy: `${sales.name} (ฝ่ายขาย)`, cancelAt: later(1), cancelReason: cancel } : {}),
  });
  await complaintRepo.insertLog(conn, id, { at: createdAt, by: `${sales.name} (ฝ่ายขาย)`, text: 'ส่งข้อร้องเรียนถึง QA' });
  if (cancel) await complaintRepo.insertLog(conn, id, { at: later(1), by: `${sales.name} (ฝ่ายขาย)`, text: `ยกเลิกข้อร้องเรียน: ${cancel}` });
  if (approval) await complaintRepo.insertLog(conn, id, { at: later(2), by: approval, text: 'อนุมัติ ปิดเรื่องและส่งผลให้ฝ่ายขาย' });
}

/* ------------------------------------------------------------
 * main
 * ---------------------------------------------------------- */
export async function seed() {
  if ((await userRepo.countAll()) > 0) return; // มีข้อมูลแล้ว ไม่ทำซ้ำ

  if (!config.seed.demo) {
    await userRepo.create({
      username: 'admin',
      passwordHash: await hashPassword(config.seed.adminPassword),
      name: 'ผู้ดูแลระบบ',
      email: 'it@surinsugar.co.th',
      role: 'admin',
      position: 'IT',
      mustChangePassword: true,
    });
    await settingsRepo.saveMailSettings({ qaEmail: '', qmrEmail: '', mgrEmails: {}, ccAll: '' });
    console.log('[seed] สร้างบัญชี admin แล้ว (รหัสผ่านจาก ADMIN_INITIAL_PASSWORD — ต้องเปลี่ยนเมื่อ login ครั้งแรก)');
    return;
  }

  // ---------- โหมดทดลอง ----------
  const hash = await hashPassword('1234');
  const usersByName = {};
  for (const u of DEMO_USERS) {
    const id = await userRepo.create({ ...u, passwordHash: hash, mustChangePassword: false });
    usersByName[u.username] = { ...u, id };
  }
  await settingsRepo.saveMailSettings(DEMO_MAIL);

  await withTransaction(async (conn) => {
    for (const c of [...historyComplaints(), ...DEMO_COMPLAINTS]) await insertDemoComplaint(conn, c, usersByName);
  });
  console.log('[seed] สร้างข้อมูลทดลองแล้ว — บัญชี: sales, sales2, qa, mgr, mgr2, mgr3, qmr, admin (รหัส 1234)');
}

// ---------- รันจาก command line ----------
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seed()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[seed] ล้มเหลว:', err.message);
      process.exit(1);
    });
}
