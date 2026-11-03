/**
 * ============================================================
 *  services/mail-service.js — ส่งอีเมลแจ้งเตือนอัตโนมัติผ่าน SMTP
 *  - ถ้าไม่ได้ตั้ง SMTP_HOST จะพิมพ์อีเมลลง console แทน (โหมดทดสอบ)
 *  - การส่งทำหลัง commit ฐานข้อมูลแล้ว และไม่ทำให้ request ล้มถ้าส่งไม่สำเร็จ
 * ============================================================
 */
import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { STATUS, SEVERITY } from '../../shared/constants.js';

// ---------- SMTP transport (สร้างครั้งเดียว) ----------
const transporter = config.mail.host
  ? nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.password } : undefined,
    })
  : null;

// ---------- หัวข้ออีเมลแต่ละ event ----------
const SUBJECT_PREFIX = {
  new: 'ข้อร้องเรียนใหม่',
  ack: 'QA รับเรื่องแล้ว',
  rev: 'รอผู้จัดการทบทวน',
  apr: 'รอ QMR อนุมัติ',
  done: 'ปิดเรื่อง — ผลการตรวจสอบ',
  back: 'ส่งกลับ QA แก้ไข',
  cx: 'ยกเลิกข้อร้องเรียน',
};

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

/**
 * สร้างเนื้อหาอีเมล
 * @param {string} event   new | ack | rev | apr | done | back | cx
 * @param {object} c       ข้อร้องเรียน (หลังอัปเดตแล้ว)
 * @param {string} message ข้อความ action เช่น "ส่งกลับ QA แก้ไข: ..."
 */
export function buildMail(event, c, message) {
  const link = `${config.baseUrl}/#/complaints/${c.id}`;
  const subject = `[${SUBJECT_PREFIX[event] || 'แจ้งเตือน'}] ${c.no} · ${c.customer}`;

  const rows = [
    ['เลขที่', c.no],
    ['สถานะ', STATUS[c.status]],
    ['ลูกค้า', c.customer],
    ['สินค้า / Lot', `${c.product} · ${c.lot}`],
    ['จำนวน', `${c.qty} ${c.unit}`],
    ['ประเภทปัญหา', c.category],
    ['กำหนดตอบกลับ', SEVERITY[c.sev]],
    ['ผู้แจ้ง', c.salesName],
  ];
  // อีเมลปิดเรื่องแนบผล QA ไปด้วย
  if (event === 'done') {
    rows.push(['สาเหตุ', c.cause], ['การแก้ไข', c.action], ['มาตรการป้องกัน', c.prevent]);
  }

  const text = [message, '', ...rows.map(([k, v]) => `${k}: ${v || '-'}`), '', `เปิดดูในระบบ: ${link}`].join('\n');
  const html = `
    <div style="font-family:Tahoma,sans-serif;font-size:14px;color:#221C1B">
      <div style="border-top:4px solid #D7262E;padding:12px 0;font-size:16px;font-weight:bold">${escapeHtml(subject)}</div>
      <p>${escapeHtml(message)}</p>
      <table cellpadding="6" style="border-collapse:collapse">
        ${rows.map(([k, v]) => `<tr><td style="color:#6E6562;vertical-align:top">${escapeHtml(k)}</td><td>${escapeHtml(v || '-')}</td></tr>`).join('')}
      </table>
      <p><a href="${escapeHtml(link)}" style="background:#D7262E;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">เปิดดูในระบบ</a></p>
      <p style="color:#9C9390;font-size:12px">อีเมลนี้ส่งอัตโนมัติจากระบบข้อร้องเรียนสินค้า บริษัท น้ำตาลสุรินทร์ จำกัด</p>
    </div>`;

  return { subject, text, html };
}

/** ส่งอีเมล (ไม่ throw — บันทึก error ลง console แทน) */
export async function sendMail(to, { subject, text, html }) {
  if (!to.length) return;
  if (!transporter) {
    console.log(`[mail:dev] ถึง ${to.join(', ')}\n  หัวข้อ: ${subject}\n  ${text.replace(/\n/g, '\n  ')}`);
    return;
  }
  try {
    await transporter.sendMail({ from: config.mail.from, to: to.join(', '), subject, text, html });
  } catch (err) {
    console.error(`[mail] ส่งไม่สำเร็จ (${subject}):`, err.message);
  }
}
