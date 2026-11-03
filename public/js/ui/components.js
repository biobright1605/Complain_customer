/**
 * ============================================================
 *  ui/components.js — ชิ้นส่วน UI ที่ใช้ซ้ำหลายหน้า
 *  (คืนค่าเป็น html`` ทั้งหมด)
 * ============================================================
 */
import { html } from '../utils/dom.js';
import { fmtDate } from '../utils/format.js';
import {
  STATUS, STATUS_COLORS, SEVERITY_COLORS, SEVERITY_SHORT, OVERDUE_COLOR,
} from '/shared/constants.js';
import { isClosed, isOverdue, daysLeft } from '/shared/workflow.js';

/** pill สถานะ (สีตาม design token) */
export function statusPill(status) {
  const [fg, bg] = STATUS_COLORS[status] || STATUS_COLORS.cx;
  return html`<span class="pill" style="color:${fg};background:${bg}">${STATUS[status]}</span>`;
}

/** จุดสี sev */
export const sevDot = (sev) =>
  html`<span class="inline-block w-2 h-2 rounded-full shrink-0" style="background:${SEVERITY_COLORS[sev] || SEVERITY_COLORS.normal}"></span>`;

/** ข้อความกำหนดตอบ: "เหลือ 3 วัน" / "เกินกำหนด 2 วัน" (แดงตัวหนา) / "ปิดแล้ว" */
export function dueText(c) {
  if (isClosed(c)) return html`<span class="text-ink-muted">${c.status === 'done' ? 'ปิดแล้ว' : '—'}</span>`;
  const left = daysLeft(c);
  return isOverdue(c)
    ? html`<span class="font-bold" style="color:${OVERDUE_COLOR}">เกินกำหนด ${Math.abs(left)} วัน</span>`
    : html`<span class="text-ink-muted">เหลือ ${left} วัน</span>`;
}

/** คอลัมน์กำหนดตอบ: จุด sev + ระยะ + เหลือ/เกิน */
export const dueCell = (c) => html`
  <div class="flex items-center gap-1.5 whitespace-nowrap">${sevDot(c.sev)}<span>${SEVERITY_SHORT[c.sev]}</span></div>
  <div class="text-[12px]">${dueText(c)}</div>`;

/** การ์ดข้อร้องเรียน (ใช้บนมือถือ และ "งานของฉัน") */
export const complaintCard = (c) => html`
  <button type="button" data-open="${c.id}"
    class="card w-full text-left p-4 flex flex-col gap-2 hover:border-brand transition-colors ${c.status === 'cx' ? 'opacity-60' : ''}">
    <div class="flex items-center justify-between gap-2">
      <span class="font-semibold">${c.no}</span>${statusPill(c.status)}
    </div>
    <div class="font-medium">${c.customer}</div>
    <div class="meta">${c.product} · Lot ${c.lot} · ${c.qty} ${c.unit}</div>
    <div class="flex items-center justify-between gap-2 text-[12px]">
      <span class="text-ink-muted">${c.category}</span>
      <span class="flex items-center gap-1.5">${sevDot(c.sev)}${dueText(c)}</span>
    </div>
    <div class="meta">${fmtDate(c.createdAt)} · ${c.salesName}</div>
  </button>`;

/** กล่องข้อความว่าง */
export const emptyState = (text) =>
  html`<div class="card p-8 text-center text-ink-muted">${text}</div>`;

/** หัวหน้า (H1 + คำอธิบาย + ปุ่มด้านขวา) */
export const pageHeader = (title, subtitle = '', right = '') => html`
  <div class="flex flex-wrap items-end justify-between gap-3 mb-5">
    <div>
      <h1>${title}</h1>
      ${subtitle ? html`<div class="text-ink-muted mt-1">${subtitle}</div>` : ''}
    </div>
    ${right}
  </div>`;

/** spinner ระหว่างโหลด */
export const loading = () => html`<div class="p-10 text-center text-ink-muted">กำลังโหลด…</div>`;
