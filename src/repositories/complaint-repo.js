/**
 * ============================================================
 *  repositories/complaint-repo.js — SQL ของ complaints / attachments / complaint_logs
 *  ทุกฟังก์ชันที่เขียนข้อมูลรับ `conn` (connection ใน transaction) เป็นตัวแรก
 * ============================================================
 */
import { pool, query } from '../db/pool.js';

/* ------------------------------------------------------------
 * แผนที่ชื่อ field: JavaScript (camelCase) -> คอลัมน์ DB (snake_case)
 * ใช้ทั้งตอนอ่านและตอน INSERT/UPDATE
 * ---------------------------------------------------------- */
const FIELD_MAP = {
  // ข้อมูลฝ่ายขาย
  sev: 'sev',
  customer: 'customer',
  contact: 'contact',
  invoice: 'invoice',
  deliveryDate: 'delivery_date',
  product: 'product',
  lot: 'lot',
  productionDate: 'production_date',
  pack: 'pack',
  qty: 'qty',
  unit: 'unit',
  category: 'category',
  customerWant: 'customer_want',
  detail: 'detail',
  mailSales: 'mail_sales',
  mailCc: 'mail_cc',
  // ผล QA
  cause: 'cause',
  action: 'action',
  prevent: 'prevent',
  owner: 'owner',
  dueDate: 'due_date',
  verify: 'verify',
  managerPosition: 'manager_position',
  // สถานะ / ทบทวน / อนุมัติ / ยกเลิก
  status: 'status',
  reviewedBy: 'reviewed_by',
  reviewedAt: 'reviewed_at',
  reviewNote: 'review_note',
  approvedBy: 'approved_by',
  approvedAt: 'approved_at',
  approveNote: 'approve_note',
  cancelBy: 'cancel_by',
  cancelAt: 'cancel_at',
  cancelReason: 'cancel_reason',
};

const ms = (d) => (d ? new Date(d).getTime() : null);

/** แปลงแถว DB -> object ข้อร้องเรียน */
function toComplaint(row) {
  const c = {
    id: row.id,
    no: row.no,
    createdAt: ms(row.created_at),
    salesUserId: row.sales_user_id,
    salesName: row.sales_name || '',
  };
  for (const [key, column] of Object.entries(FIELD_MAP)) c[key] = row[column] ?? '';

  // รวม field ที่เป็นกลุ่มเดียวกันให้อ่านง่ายในหน้าเว็บ
  c.review = row.reviewed_by ? { by: row.reviewed_by, at: ms(row.reviewed_at), note: row.review_note || '' } : null;
  c.approval = row.approved_by ? { by: row.approved_by, at: ms(row.approved_at), note: row.approve_note || '' } : null;
  c.cancel = row.cancel_by ? { by: row.cancel_by, at: ms(row.cancel_at), reason: row.cancel_reason || '' } : null;
  for (const k of ['reviewedBy', 'reviewedAt', 'reviewNote', 'approvedBy', 'approvedAt', 'approveNote', 'cancelBy', 'cancelAt', 'cancelReason']) {
    delete c[k];
  }
  return c;
}

const toAttachment = (row) => ({
  id: row.id,
  complaintId: row.complaint_id,
  kind: row.kind,
  filename: row.filename,
  path: row.path,
  mime: row.mime,
  size: row.size_bytes,
  uploadedBy: row.uploaded_by,
  uploadedAt: ms(row.uploaded_at),
});

const toLog = (row) => ({ at: ms(row.at), by: row.by_text, text: row.text, isMail: !!row.is_mail });

const SELECT_COMPLAINT = `
  SELECT c.*, u.name AS sales_name
  FROM complaints c
  JOIN users u ON u.id = c.sales_user_id`;

/* ------------------------------------------------------------
 * อ่านข้อมูล
 * ---------------------------------------------------------- */

/** รายการทั้งหมด (ฝ่ายขาย: ส่ง salesUserId เพื่อกรองเฉพาะของตัวเอง) */
export async function listComplaints({ salesUserId } = {}) {
  const where = salesUserId ? 'WHERE c.sales_user_id = ?' : '';
  const rows = await query(`${SELECT_COMPLAINT} ${where} ORDER BY c.created_at DESC`, salesUserId ? [salesUserId] : []);
  return rows.map(toComplaint);
}

/** อ่าน 1 เรื่อง — ถ้าส่ง conn (ใน transaction) จะล็อกแถวไว้ด้วย (FOR UPDATE) */
export async function findComplaint(id, conn = null) {
  const sql = `${SELECT_COMPLAINT} WHERE c.id = ?${conn ? ' FOR UPDATE' : ''}`;
  const [rows] = await (conn || pool).query(sql, [id]);
  return rows[0] ? toComplaint(rows[0]) : null;
}

export async function listAttachments(complaintId) {
  const rows = await query('SELECT * FROM attachments WHERE complaint_id = ? ORDER BY uploaded_at, id', [complaintId]);
  return rows.map(toAttachment);
}

export async function findAttachment(id) {
  const rows = await query('SELECT * FROM attachments WHERE id = ?', [id]);
  return rows[0] ? toAttachment(rows[0]) : null;
}

export async function countAttachments(conn, complaintId, kind) {
  const [rows] = await conn.query('SELECT COUNT(*) AS n FROM attachments WHERE complaint_id = ? AND kind = ?', [complaintId, kind]);
  return Number(rows[0].n);
}

/** timeline ใหม่สุดอยู่บน */
export async function listLogs(complaintId) {
  const rows = await query('SELECT * FROM complaint_logs WHERE complaint_id = ? ORDER BY at DESC, id DESC', [complaintId]);
  return rows.map(toLog);
}

/* ------------------------------------------------------------
 * เขียนข้อมูล (ใช้ภายใน transaction)
 * ---------------------------------------------------------- */

/** หาเลขลำดับถัดไปของวันนั้น: SC-691103-01, -02, ... */
export async function nextComplaintNo(conn, prefix) {
  const [rows] = await conn.query('SELECT no FROM complaints WHERE no LIKE ? ORDER BY no DESC LIMIT 1 FOR UPDATE', [`${prefix}-%`]);
  const last = rows[0] ? Number.parseInt(rows[0].no.split('-').pop(), 10) : 0;
  return `${prefix}-${String(last + 1).padStart(2, '0')}`;
}

export async function insertComplaint(conn, { no, createdAt, salesUserId, ...fields }) {
  const columns = ['no', 'created_at', 'sales_user_id'];
  const values = [no, createdAt, salesUserId];
  for (const [key, value] of Object.entries(fields)) {
    if (FIELD_MAP[key]) {
      columns.push(FIELD_MAP[key]);
      values.push(value === '' && key.endsWith('Date') ? null : value);
    }
  }
  const [result] = await conn.query(
    `INSERT INTO complaints (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    values,
  );
  return result.insertId;
}

/** อัปเดตเฉพาะ field ที่อยู่ใน FIELD_MAP */
export async function updateComplaint(conn, id, fields) {
  const sets = [];
  const values = [];
  for (const [key, value] of Object.entries(fields)) {
    if (!FIELD_MAP[key]) continue;
    sets.push(`${FIELD_MAP[key]} = ?`);
    values.push(value === '' && (key.endsWith('Date') || key.endsWith('At')) ? null : value);
  }
  if (!sets.length) return;
  await conn.query(`UPDATE complaints SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
}

export async function insertLog(conn, complaintId, { at, by, text, isMail = false }) {
  await conn.query('INSERT INTO complaint_logs (complaint_id, at, by_text, text, is_mail) VALUES (?, ?, ?, ?, ?)', [
    complaintId,
    at,
    by,
    text,
    isMail ? 1 : 0,
  ]);
}

export async function insertAttachment(conn, a) {
  await conn.query(
    `INSERT INTO attachments (complaint_id, kind, filename, path, mime, size_bytes, uploaded_by, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [a.complaintId, a.kind, a.filename, a.path, a.mime, a.size, a.uploadedBy, a.uploadedAt],
  );
}

export async function deleteAttachment(conn, id) {
  await conn.query('DELETE FROM attachments WHERE id = ?', [id]);
}
