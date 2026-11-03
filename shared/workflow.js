/**
 * ============================================================
 *  shared/workflow.js — กฎธุรกิจ (pure functions ไม่มี I/O)
 *  ใช้ร่วมกัน:
 *    - Back-End : บังคับสิทธิ์และการเปลี่ยนสถานะ (แหล่งความจริง)
 *    - Front-End: ซ่อน/แสดงปุ่ม, คำนวณกำหนดตอบ, filter
 *  ถ้าจะแก้ workflow ให้แก้ที่ไฟล์นี้ แล้วรัน `npm test`
 * ============================================================
 */
import { SEVERITY_DAYS, MANAGER_POSITIONS } from './constants.js';

export const DAY_MS = 86_400_000;

/* ------------------------------------------------------------
 * 1) กำหนดตอบ / เกินกำหนด
 * ---------------------------------------------------------- */

/** เวลาครบกำหนดตอบ (ms) = วันที่แจ้ง + จำนวนวันตาม sev (วันปฏิทิน) */
export const dueAt = (c) => c.createdAt + (SEVERITY_DAYS[c.sev] || 14) * DAY_MS;

/** ปิดเรื่องหรือยกเลิกแล้ว */
export const isClosed = (c) => c.status === 'done' || c.status === 'cx';

/** ยังไม่ปิด และเลยวันครบกำหนดแล้ว */
export const isOverdue = (c, now = Date.now()) => !isClosed(c) && now > dueAt(c);

/** จำนวนวันที่เหลือ (ติดลบ = เกินกำหนด) */
export const daysLeft = (c, now = Date.now()) => Math.ceil((dueAt(c) - now) / DAY_MS);

/* ------------------------------------------------------------
 * 2) ค้นหา / filter / งานของฉัน
 * ---------------------------------------------------------- */

/** filter chip: all | new | prog | wait | done | cx | over */
export function matchFilter(c, key, now = Date.now()) {
  switch (key) {
    case 'all': return true;
    case 'prog': return c.status === 'ack' || c.status === 'inv';
    case 'wait': return c.status === 'rev' || c.status === 'apr';
    case 'over': return isOverdue(c, now);
    default: return c.status === key;
  }
}

/** ค้นหาจาก เลขที่ / ลูกค้า / Lot / ผู้แจ้ง / สินค้า / ประเภท */
export function matchSearch(c, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return [c.no, c.customer, c.lot, c.salesName, c.product, c.category]
    .some((v) => String(v || '').toLowerCase().includes(q));
}

/** กรองรายการตาม filter + คำค้น (ใช้ทั้งหน้าจอและตอนส่งออกไฟล์) */
export const applyListFilter = (list, { filter = 'all', q = '' } = {}, now = Date.now()) =>
  list.filter((c) => matchFilter(c, filter, now) && matchSearch(c, q));

/** "งานของฉัน" ตามบทบาท */
export function tasksFor(user, list, now = Date.now()) {
  switch (user.role) {
    case 'sales': return list.filter((c) => c.salesUserId === user.id && !isClosed(c));
    case 'qa': return list.filter((c) => ['new', 'ack', 'inv'].includes(c.status));
    case 'mgr': return list.filter((c) => c.status === 'rev' && c.managerPosition === user.position);
    case 'qmr': return list.filter((c) => c.status === 'apr');
    default: return list.filter((c) => isOverdue(c, now));
  }
}

/* ------------------------------------------------------------
 * 3) สิทธิ์การมองเห็น
 * ---------------------------------------------------------- */

/** ฝ่ายขายเห็นเฉพาะเรื่องของตัวเอง, บทบาทอื่นเห็นทั้งหมด */
export const canView = (user, c) => user.role !== 'sales' || c.salesUserId === user.id;

/** ฝ่ายขายเห็นผล QA (สาเหตุ/การแก้ไข/ป้องกัน/หลักฐาน QA) เมื่อปิดเรื่องแล้วเท่านั้น */
export const canSeeQaResult = (user, c) => user.role !== 'sales' || c.status === 'done';

/** QA แก้ไขผลตรวจสอบได้เฉพาะสถานะ new/ack/inv */
export const isQaEditable = (c) => ['new', 'ack', 'inv'].includes(c.status);

/** หน้าตั้งค่า: admin, qa (จัดการผู้ใช้ได้), qmr (ดูผู้ใช้ + แก้อีเมล) */
export const canOpenSettings = (user) => ['admin', 'qa', 'qmr'].includes(user.role);
export const canManageUsers = (user) => ['admin', 'qa'].includes(user.role);
export const canEditMailSettings = (user) => ['admin', 'qa', 'qmr'].includes(user.role);

/* ------------------------------------------------------------
 * 4) Action ของ workflow
 *    roles     : บทบาทที่ทำได้
 *    from      : สถานะที่อนุญาต
 *    to        : สถานะใหม่ (function = ขึ้นกับสถานะเดิม, null = ไม่เปลี่ยน)
 *    mail      : event สำหรับส่งอีเมล (null = ไม่ส่ง)
 *    needReason: ต้องระบุเหตุผล
 *    check     : เงื่อนไขเพิ่มเติม (เช่น ผู้จัดการต้องตรงตำแหน่ง)
 * ---------------------------------------------------------- */
const OPEN_STATUSES = ['new', 'ack', 'inv', 'rev', 'apr'];
const ownComplaint = (user, c) => c.salesUserId === user.id;
const isAssignedManager = (user, c) => user.position === c.managerPosition;

export const ACTIONS = Object.freeze({
  ack: { roles: ['qa'], from: ['new'], to: 'ack', mail: 'ack' },
  // บันทึกร่างผล QA: ครั้งแรกจะเปลี่ยนสถานะเป็น "กำลังตรวจสอบ"
  saveQa: { roles: ['qa'], from: ['new', 'ack', 'inv'], to: 'inv', mail: null },
  submitReview: { roles: ['qa'], from: ['new', 'ack', 'inv'], to: 'rev', mail: 'rev' },
  qaFile: { roles: ['qa'], from: ['new', 'ack', 'inv'], to: null, mail: null },
  review: { roles: ['mgr'], from: ['rev'], to: 'apr', mail: 'apr', check: isAssignedManager },
  sendBack: { roles: ['mgr'], from: ['rev'], to: 'inv', mail: 'back', needReason: true, check: isAssignedManager },
  approve: { roles: ['qmr'], from: ['apr'], to: 'done', mail: 'done' },
  reject: { roles: ['qmr'], from: ['apr'], to: 'inv', mail: 'back', needReason: true },
  cancel: { roles: ['sales'], from: OPEN_STATUSES, to: 'cx', mail: 'cx', needReason: true, check: ownComplaint },
  note: { roles: ['sales', 'qa', 'mgr', 'qmr', 'admin'], from: [...OPEN_STATUSES, 'done', 'cx'], to: null, mail: null },
});

/** ตรวจว่าผู้ใช้ทำ action นี้กับเรื่องนี้ได้หรือไม่ */
export function canDo(user, c, actionName) {
  const a = ACTIONS[actionName];
  if (!a || !canView(user, c)) return false;
  if (!a.roles.includes(user.role)) return false;
  if (!a.from.includes(c.status)) return false;
  return a.check ? a.check(user, c) : true;
}

/** รายชื่อ action ทั้งหมดที่ผู้ใช้ทำได้ (ให้หน้าเว็บใช้แสดงปุ่ม) */
export const allowedActions = (user, c) => Object.keys(ACTIONS).filter((name) => canDo(user, c, name));

/** สถานะถัดไปหลังทำ action */
export function nextStatus(c, actionName) {
  const { to } = ACTIONS[actionName];
  if (to === null) return c.status;
  return typeof to === 'function' ? to(c.status) : to;
}

/* ------------------------------------------------------------
 * 5) ตรวจข้อมูลก่อน QA ส่งทบทวน
 *    ต้องมี: ผู้จัดการ, สาเหตุ, การแก้ไข, มาตรการป้องกัน + หลักฐาน >= 1 ไฟล์
 * ---------------------------------------------------------- */
export function missingForReview(qa, qaAttachmentCount) {
  const missing = [];
  if (!MANAGER_POSITIONS.includes(qa.managerPosition)) missing.push('ผู้จัดการที่เกี่ยวข้อง');
  if (!String(qa.cause || '').trim()) missing.push('สาเหตุ');
  if (!String(qa.action || '').trim()) missing.push('การแก้ไข');
  if (!String(qa.prevent || '').trim()) missing.push('มาตรการป้องกัน');
  if (qaAttachmentCount < 1) missing.push('หลักฐานการแก้ไขอย่างน้อย 1 ไฟล์');
  return missing;
}

/* ------------------------------------------------------------
 * 6) ผู้รับอีเมลแต่ละ event
 *    new / back / cx -> QA
 *    ack             -> ฝ่ายขายผู้แจ้ง
 *    rev             -> ผู้จัดการตามตำแหน่ง
 *    apr             -> QMR
 *    done            -> ฝ่ายขาย + QA + ผู้จัดการ
 *    ทุกฉบับ + CC รวม + CC รายเรื่อง, ตัดซ้ำ
 * ---------------------------------------------------------- */
export const splitEmails = (text) =>
  String(text || '').split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);

export function mailRecipients(event, c, mailSettings) {
  const { qaEmail, qmrEmail, mgrEmails = {}, ccAll } = mailSettings;
  const salesEmail = c.mailSales;
  const mgrEmail = mgrEmails[c.managerPosition];

  const primary = {
    new: [qaEmail],
    back: [qaEmail],
    cx: [qaEmail],
    ack: [salesEmail],
    rev: [mgrEmail],
    apr: [qmrEmail],
    done: [salesEmail, qaEmail, mgrEmail],
  }[event] || [];

  const all = [...primary, ...splitEmails(ccAll), ...splitEmails(c.mailCc)]
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(all)];
}

/* ------------------------------------------------------------
 * 7) อื่น ๆ
 * ---------------------------------------------------------- */

/** รูปแบบอีเมลพื้นฐาน */
export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());

/** prefix เลขที่: SC-YYMMDD (YY = พ.ศ. 2 หลัก) เช่น 3 พ.ย. 2026 -> SC-691103 */
export function complaintNoPrefix(date = new Date()) {
  const p2 = (n) => String(n).padStart(2, '0');
  const yy = p2((date.getFullYear() + 543) % 100);
  return `SC-${yy}${p2(date.getMonth() + 1)}${p2(date.getDate())}`;
}
