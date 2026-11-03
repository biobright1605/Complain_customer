/**
 * ============================================================
 *  views/tasks.js — งานของฉัน (ตามบทบาท)
 *   sales: เรื่องของฉันที่ยังไม่ปิด / qa: new, ack, inv
 *   mgr  : rev ที่ตรงตำแหน่ง / qmr: apr / admin: เกินกำหนด
 * ============================================================
 */
import { html, on } from '../utils/dom.js';
import { state } from '../state.js';
import { complaintCard, emptyState, pageHeader } from '../ui/components.js';
import { tasksFor, dueAt } from '/shared/workflow.js';

const SUBTITLE = {
  sales: 'ข้อร้องเรียนของฉันที่ยังไม่ปิดเรื่อง',
  qa: 'เรื่องที่รอ QA รับเรื่อง / ตรวจสอบ',
  mgr: 'เรื่องที่รอคุณทบทวน',
  qmr: 'เรื่องที่รอ QMR อนุมัติ',
  admin: 'เรื่องที่เกินกำหนดตอบ',
};

export function renderTasks(root) {
  const user = state.user;
  const tasks = tasksFor(user, state.items).sort((a, b) => dueAt(a) - dueAt(b));

  root.innerHTML = html`
    ${pageHeader('งานของฉัน', SUBTITLE[user.role])}
    <div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">
      ${tasks.length ? tasks.map(complaintCard) : emptyState('ไม่มีงานค้าง')}
    </div>`;

  on(root, 'click', '[data-open]', (e, el) => {
    location.hash = `#/complaints/${el.dataset.open}`;
  });
}
