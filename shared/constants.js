/**
 * ============================================================
 *  shared/constants.js — ค่าคงที่ที่ใช้ร่วมกันทั้ง Back-End และ Front-End
 *  (ไฟล์นี้ถูก serve ให้ browser ที่ /shared/constants.js ด้วย)
 *  แก้ตัวเลือกสินค้า / ประเภทปัญหา / หน่วย / ตำแหน่งผู้จัดการ ได้ที่นี่ที่เดียว
 * ============================================================
 */

// ---------- บทบาทผู้ใช้ ----------
export const ROLES = Object.freeze({
  sales: 'ฝ่ายขาย',
  qa: 'QA โรงงาน',
  mgr: 'ผู้จัดการ',
  qmr: 'QMR',
  admin: 'ผู้ดูแลระบบ',
});

// ---------- ตำแหน่งผู้จัดการ (ใช้เลือกผู้ทบทวน) ----------
export const MANAGER_POSITIONS = Object.freeze([
  'ผู้จัดการฝ่ายผลิต',
  'ผู้จัดการคลังสินค้า',
  'ผู้จัดการส่วนจัดซื้อ',
]);

// ---------- สถานะ workflow ----------
export const STATUS = Object.freeze({
  new: 'ใหม่',
  ack: 'รับเรื่องแล้ว',
  inv: 'กำลังตรวจสอบ',
  rev: 'รอผู้จัดการทบทวน',
  apr: 'รอ QMR อนุมัติ',
  done: 'ปิดเรื่อง',
  cx: 'ยกเลิก',
});

/** ลำดับขั้นสำหรับ stepper (ไม่รวม cx) */
export const FLOW = Object.freeze(['new', 'ack', 'inv', 'rev', 'apr', 'done']);

/** สีสถานะ [ตัวอักษร, พื้นหลัง] */
export const STATUS_COLORS = Object.freeze({
  new: ['#1E5AA0', '#E6EFFA'],
  ack: ['#8A5A00', '#FBF0D9'],
  inv: ['#B0400E', '#FCE9DF'],
  rev: ['#6A3E9E', '#F0E9F8'],
  apr: ['#6A3E9E', '#F0E9F8'],
  done: ['#22703F', '#E2F2E8'],
  cx: ['#6E6562', '#EEEAE8'],
});

// ---------- กำหนดตอบกลับ (sev) ----------
export const SEVERITY = Object.freeze({
  urgent: 'ตอบภายใน 3 วัน',
  high: 'ตอบภายใน 7 วัน',
  normal: 'ตอบภายใน 14 วัน',
});
export const SEVERITY_SHORT = Object.freeze({ urgent: '3 วัน', high: '7 วัน', normal: '14 วัน' });
export const SEVERITY_DAYS = Object.freeze({ urgent: 3, high: 7, normal: 14 });
export const SEVERITY_COLORS = Object.freeze({ urgent: '#D7262E', high: '#C27A0E', normal: '#9C9390' });
export const OVERDUE_COLOR = '#C11F27';

// ---------- ตัวเลือกในฟอร์ม ----------
export const PRODUCTS = Object.freeze([
  'น้ำตาลทรายขาว',
  'น้ำตาลทรายขาวบริสุทธิ์',
  'น้ำตาลทรายดิบ',
  'น้ำตาลทรายแดง',
  'น้ำตาลก้อน',
  'น้ำตาลไอซิ่ง',
  'อื่น ๆ',
]);

export const CATEGORIES = Object.freeze([
  'สิ่งแปลกปลอม',
  'สี / ความขาวผิดปกติ',
  'ความชื้น / จับตัวเป็นก้อน',
  'กลิ่น / รสผิดปกติ',
  'ขนาดเม็ดไม่สม่ำเสมอ',
  'น้ำหนักไม่ครบ',
  'บรรจุภัณฑ์ชำรุด / ฉีกขาด',
  'ฉลาก / Lot ไม่ถูกต้อง',
  'การปนเปื้อน',
  'อื่น ๆ',
]);

export const UNITS = Object.freeze(['กระสอบ', 'ตัน', 'กิโลกรัม', 'ถุง', 'กล่อง']);

// ---------- ไฟล์แนบที่อนุญาต ----------
export const ALLOWED_MIME = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

// ---------- Filter chip ในหน้ารายการ ----------
export const LIST_FILTERS = Object.freeze([
  ['all', 'ทั้งหมด'],
  ['new', 'ใหม่'],
  ['prog', 'ดำเนินการ'],
  ['wait', 'รอทบทวน-อนุมัติ'],
  ['done', 'ปิดเรื่อง'],
  ['cx', 'ยกเลิก'],
  ['over', 'เกินกำหนด'],
]);

// ---------- คอลัมน์สำหรับส่งออก Excel / CSV ----------
export const EXPORT_COLUMNS = Object.freeze([
  ['no', 'เลขที่', 16],
  ['createdAt', 'วันที่แจ้ง', 16],
  ['status', 'สถานะ', 16],
  ['sev', 'กำหนดตอบกลับ', 16],
  ['salesName', 'ผู้แจ้ง', 16],
  ['customer', 'ลูกค้า', 30],
  ['contact', 'ผู้ติดต่อ', 22],
  ['invoice', 'Invoice', 14],
  ['product', 'สินค้า', 22],
  ['lot', 'Lot / Batch', 16],
  ['productionDate', 'วันที่ผลิต', 12],
  ['deliveryDate', 'วันที่ส่งมอบ', 12],
  ['qty', 'จำนวน', 8],
  ['unit', 'หน่วย', 10],
  ['pack', 'ขนาดบรรจุ', 16],
  ['category', 'ประเภทปัญหา', 24],
  ['customerWant', 'ลูกค้าต้องการ', 22],
  ['detail', 'รายละเอียด', 48],
  ['cause', 'สาเหตุ', 40],
  ['action', 'การแก้ไข', 40],
  ['prevent', 'มาตรการป้องกัน', 40],
  ['owner', 'ผู้รับผิดชอบ', 18],
  ['dueDate', 'กำหนดเสร็จ', 12],
  ['verify', 'ผลติดตาม', 30],
  ['managerPosition', 'ผู้จัดการที่เกี่ยวข้อง', 22],
]);
