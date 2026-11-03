/**
 * ============================================================
 *  services/complaint-service.js — กฎธุรกิจของข้อร้องเรียน
 *  ลำดับงานของทุก action:
 *    1) เปิด transaction + ล็อกแถว
 *    2) ตรวจสิทธิ์ด้วย shared/workflow.js (canDo)
 *    3) อัปเดตข้อมูล + บันทึก timeline
 *    4) คำนวณผู้รับอีเมล + บันทึก log อีเมล
 *    5) commit แล้วจึงส่งอีเมลจริง
 * ============================================================
 */
import { withTransaction } from '../db/pool.js';
import * as repo from '../repositories/complaint-repo.js';
import * as settingsRepo from '../repositories/settings-repo.js';
import { buildMail, sendMail } from './mail-service.js';
import { toAttachmentRecord, removeFiles, absolutePath } from './file-storage.js';
import { badRequest, forbidden, notFound, conflict } from '../utils/http-error.js';
import { PRODUCTS, CATEGORIES, UNITS, SEVERITY, MANAGER_POSITIONS, ROLES } from '../../shared/constants.js';
import {
  ACTIONS,
  allowedActions,
  canDo,
  canSeeQaResult,
  canView,
  complaintNoPrefix,
  isEmail,
  mailRecipients,
  missingForReview,
  nextStatus,
  splitEmails,
} from '../../shared/workflow.js';

/* ------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------- */

/** ข้อความผู้ทำรายการใน timeline: "ชื่อ (ตำแหน่ง)" — มาจากบัญชีที่ login เสมอ */
export const actorText = (user) => `${user.name} (${user.position || ROLES[user.role]})`;

const text = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const isDate = (v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v);
const QA_FIELDS = ['cause', 'action', 'prevent', 'owner', 'dueDate', 'verify', 'managerPosition'];

/** ซ่อนผล QA จากฝ่ายขายจนกว่าจะปิดเรื่อง */
function redact(user, c) {
  if (canSeeQaResult(user, c)) return c;
  const hidden = { ...c, review: null, approval: null };
  for (const k of QA_FIELDS) hidden[k] = k === 'managerPosition' ? c.managerPosition : '';
  return hidden;
}

/** ส่งอีเมลหลัง commit (ไม่รอผล) */
function dispatchMails(mails) {
  for (const m of mails) sendMail(m.to, buildMail(m.event, m.complaint, m.message));
}

/**
 * บันทึก log + เตรียมอีเมลของ event
 * คืนค่า object สำหรับ dispatchMails() หรือ null ถ้าไม่มีผู้รับ
 */
async function queueMail(conn, event, complaint, message, now) {
  const settings = await settingsRepo.getMailSettings();
  const to = mailRecipients(event, complaint, settings);
  if (!to.length) return null;
  await repo.insertLog(conn, complaint.id, { at: now, by: 'ระบบ', text: `ส่งอีเมลแจ้งอัตโนมัติถึง ${to.join(', ')}`, isMail: true });
  return { event, complaint, message, to };
}

/* ------------------------------------------------------------
 * อ่านข้อมูล
 * ---------------------------------------------------------- */

export async function listForUser(user) {
  const list = await repo.listComplaints(user.role === 'sales' ? { salesUserId: user.id } : {});
  return list.map((c) => redact(user, c));
}

export async function getDetail(user, id) {
  const c = await repo.findComplaint(id);
  if (!c || !canView(user, c)) throw notFound('ไม่พบข้อร้องเรียน');

  const showQa = canSeeQaResult(user, c);
  const attachments = (await repo.listAttachments(id))
    .filter((a) => a.kind === 'sales' || showQa)
    .map(({ path, ...rest }) => rest); // ไม่ส่ง path จริงบน server ให้ browser

  return {
    ...redact(user, c),
    attachments,
    logs: await repo.listLogs(id),
    actions: allowedActions(user, c),
  };
}

/** ไฟล์แนบสำหรับดาวน์โหลด (ตรวจสิทธิ์ก่อน) */
export async function getAttachmentFile(user, attachmentId) {
  const a = await repo.findAttachment(attachmentId);
  if (!a) throw notFound('ไม่พบไฟล์');
  const c = await repo.findComplaint(a.complaintId);
  if (!c || !canView(user, c)) throw notFound('ไม่พบไฟล์');
  if (a.kind === 'qa' && !canSeeQaResult(user, c)) throw forbidden();
  return { ...a, absolutePath: absolutePath(a.path) };
}

/* ------------------------------------------------------------
 * แจ้งข้อร้องเรียนใหม่ (ฝ่ายขาย)
 * ---------------------------------------------------------- */

/** ตรวจและทำความสะอาดข้อมูลฟอร์มแจ้งเรื่อง */
export function validateNewComplaint(body) {
  const f = {
    customer: text(body.customer, 200),
    contact: text(body.contact, 200),
    invoice: text(body.invoice, 80),
    deliveryDate: text(body.deliveryDate, 10),
    product: text(body.product, 80),
    lot: text(body.lot, 80),
    productionDate: text(body.productionDate, 10),
    pack: text(body.pack, 80),
    qty: text(body.qty, 30),
    unit: text(body.unit, 30),
    category: text(body.category, 80),
    sev: text(body.sev, 10),
    customerWant: text(body.customerWant, 255),
    detail: text(body.detail, 5000),
    mailSales: text(body.mailSales, 160),
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

  const badEmails = [f.mailSales, ...splitEmails(f.mailCc)].filter((e) => e && !isEmail(e));
  if (badEmails.length) throw badRequest(`รูปแบบอีเมลไม่ถูกต้อง: ${badEmails.join(', ')}`);
  return f;
}

export async function create(user, body, files = []) {
  if (user.role !== 'sales') {
    removeFiles(files.map((f) => f.path));
    throw forbidden('เฉพาะฝ่ายขายเท่านั้นที่แจ้งข้อร้องเรียนได้');
  }

  let fields;
  try {
    fields = validateNewComplaint(body);
  } catch (err) {
    removeFiles(files.map((f) => f.path));
    throw err;
  }
  if (!fields.mailSales) fields.mailSales = user.email;

  // ลองใหม่สูงสุด 3 ครั้ง กรณีเลขที่ชนกัน (มีคนส่งพร้อมกัน)
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { complaint, mail } = await withTransaction(async (conn) => {
        const now = new Date();
        const no = await repo.nextComplaintNo(conn, complaintNoPrefix(now));
        const id = await repo.insertComplaint(conn, { ...fields, no, createdAt: now, salesUserId: user.id, status: 'new' });

        for (const file of files) {
          await repo.insertAttachment(conn, { ...toAttachmentRecord(file), complaintId: id, kind: 'sales', uploadedBy: actorText(user), uploadedAt: now });
        }
        await repo.insertLog(conn, id, { at: now, by: actorText(user), text: 'ส่งข้อร้องเรียนถึง QA' });

        const saved = await repo.findComplaint(id, conn);
        const queued = await queueMail(conn, 'new', saved, `ฝ่ายขายแจ้งข้อร้องเรียนใหม่ ${no}`, now);
        return { complaint: saved, mail: queued };
      });
      if (mail) dispatchMails([mail]);
      return { id: complaint.id, no: complaint.no, mailedTo: mail?.to || [] };
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' && attempt < 3) continue;
      removeFiles(files.map((f) => f.path));
      throw err;
    }
  }
  throw conflict('สร้างเลขที่ไม่สำเร็จ กรุณาลองใหม่');
}

/* ------------------------------------------------------------
 * Workflow actions
 * ---------------------------------------------------------- */

/** อ่านเฉพาะช่องผล QA จาก body */
function pickQaFields(body) {
  const f = {
    cause: text(body.cause, 5000),
    action: text(body.action, 5000),
    prevent: text(body.prevent, 5000),
    owner: text(body.owner, 160),
    dueDate: text(body.dueDate, 10),
    verify: text(body.verify, 5000),
    managerPosition: text(body.managerPosition, 80),
  };
  if (!isDate(f.dueDate)) throw badRequest('รูปแบบกำหนดเสร็จไม่ถูกต้อง');
  if (f.managerPosition && !MANAGER_POSITIONS.includes(f.managerPosition)) throw badRequest('ตำแหน่งผู้จัดการไม่ถูกต้อง');
  return f;
}

/**
 * แต่ละ action คืนค่า { fields, log, mailMessage? }
 *   fields     : field ที่จะอัปเดต (ไม่รวม status — คำนวณจาก ACTIONS)
 *   log        : ข้อความ timeline
 *   okMessage  : ข้อความแจ้งผู้ใช้ (toast)
 */
const HANDLERS = {
  ack: () => ({ fields: {}, log: 'รับเรื่องแล้ว', okMessage: 'รับเรื่องแล้ว' }),

  saveQa: ({ c, body }) => ({
    fields: pickQaFields(body),
    log: c.status === 'inv' ? 'บันทึกผลการตรวจสอบ' : 'เริ่มตรวจสอบ · บันทึกผล',
    okMessage: 'บันทึกร่างแล้ว',
  }),

  submitReview: async ({ c, body, conn }) => {
    const fields = pickQaFields(body);
    const missing = missingForReview(fields, await repo.countAttachments(conn, c.id, 'qa'));
    if (missing.length) throw badRequest(`ก่อนส่งทบทวน กรุณาระบุ: ${missing.join(', ')}`);
    return {
      fields,
      log: `ส่งให้ ${fields.managerPosition} ทบทวน`,
      okMessage: `ส่งให้ ${fields.managerPosition} ทบทวนแล้ว`,
    };
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

/** ข้อความแจ้งเมื่อไม่ได้ใส่เหตุผล */
const REASON_REQUIRED = {
  sendBack: 'กรุณาระบุเหตุผลที่ส่งกลับ',
  reject: 'กรุณาระบุเหตุผลที่ไม่อนุมัติ',
  cancel: 'กรุณาระบุเหตุผลที่ยกเลิก',
};

export async function performAction(user, id, actionName, body = {}) {
  const def = ACTIONS[actionName];
  const handler = HANDLERS[actionName];
  if (!def || !handler || actionName === 'qaFile') throw badRequest('action ไม่ถูกต้อง');

  const note = text(body.note, 2000);
  if (def.needReason && !note) throw badRequest(REASON_REQUIRED[actionName]);

  const { result, mail } = await withTransaction(async (conn) => {
    const c = await repo.findComplaint(id, conn);
    if (!c || !canView(user, c)) throw notFound('ไม่พบข้อร้องเรียน');
    if (!canDo(user, c, actionName)) throw forbidden('ไม่สามารถทำรายการนี้ได้ในสถานะปัจจุบัน หรือไม่มีสิทธิ์');

    const now = new Date();
    const out = await handler({ user, c, body, note, now, conn });
    const status = nextStatus(c, actionName);

    await repo.updateComplaint(conn, id, { ...out.fields, status });
    await repo.insertLog(conn, id, { at: now, by: actorText(user), text: out.log });

    const updated = await repo.findComplaint(id, conn);
    const queued = def.mail ? await queueMail(conn, def.mail, updated, out.log, now) : null;
    return { result: { status, message: out.okMessage, mailedTo: queued?.to || [] }, mail: queued };
  });

  if (mail) dispatchMails([mail]);
  return result;
}

/* ------------------------------------------------------------
 * หลักฐานของ QA (แนบ / ลบ)
 * ---------------------------------------------------------- */

export async function addQaFiles(user, id, files) {
  if (!files.length) throw badRequest('กรุณาเลือกไฟล์');
  try {
    await withTransaction(async (conn) => {
      const c = await repo.findComplaint(id, conn);
      if (!c || !canDo(user, c, 'qaFile')) throw forbidden();
      const now = new Date();
      const records = files.map(toAttachmentRecord);
      for (const r of records) {
        await repo.insertAttachment(conn, { ...r, complaintId: id, kind: 'qa', uploadedBy: actorText(user), uploadedAt: now });
      }
      await repo.insertLog(conn, id, { at: now, by: actorText(user), text: `แนบหลักฐาน: ${records.map((r) => r.filename).join(', ')}` });
    });
  } catch (err) {
    removeFiles(files.map((f) => f.path));
    throw err;
  }
}

export async function removeQaFile(user, attachmentId) {
  const a = await repo.findAttachment(attachmentId);
  if (!a || a.kind !== 'qa') throw notFound('ไม่พบไฟล์');

  await withTransaction(async (conn) => {
    const c = await repo.findComplaint(a.complaintId, conn);
    if (!c || !canDo(user, c, 'qaFile')) throw forbidden();
    await repo.deleteAttachment(conn, a.id);
    await repo.insertLog(conn, c.id, { at: new Date(), by: actorText(user), text: `ลบไฟล์แนบ: ${a.filename}` });
  });
  removeFiles([absolutePath(a.path)]);
}
