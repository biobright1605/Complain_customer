/**
 * ============================================================
 *  views/dashboard.js — หน้าภาพรวม
 *   1) การ์ดสถิติ 6 ใบ (กดแล้วไปหน้ารายการพร้อม filter)
 *   2) กราฟข้อร้องเรียนตามช่วงเวลา
 *   3) งานของฉัน (สูงสุด 6 เรื่อง เรียงตามวันครบกำหนด)
 *   4) ประเภทปัญหาที่พบ (progress bar)
 * ============================================================
 */
import { html, $, on } from '../utils/dom.js';
import { state } from '../state.js';
import { complaintCard, emptyState, pageHeader } from '../ui/components.js';
import { renderChartPanel } from './complaint-chart.js';
import { matchFilter, tasksFor, dueAt } from '/shared/workflow.js';
import { CATEGORIES } from '/shared/constants.js';

const MAX_TASKS = 6;

/** การ์ดสถิติ: [filter key, ชื่อ, สีตัวเลข] */
const STAT_CARDS = [
  ['all', 'ทั้งหมด', '#221C1B'],
  ['new', 'ใหม่', '#1E5AA0'],
  ['prog', 'กำลังดำเนินการ', '#B0400E'],
  ['wait', 'รอทบทวน-อนุมัติ', '#6A3E9E'],
  ['done', 'ปิดเรื่อง', '#22703F'],
  ['over', 'เกินกำหนดตอบ', '#C11F27'],
];

function categoryStats(items) {
  const active = items.filter((i) => i.status !== 'cx');
  const counts = CATEGORIES.map((cat) => [cat, active.filter((i) => i.category === cat).length]).filter(([, n]) => n > 0);
  counts.sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...counts.map(([, n]) => n));
  return counts.map(([cat, n]) => ({ cat, n, pct: Math.round((n / max) * 100) }));
}

export function renderDashboard(root) {
  const items = state.items;
  const tasks = tasksFor(state.user, items).sort((a, b) => dueAt(a) - dueAt(b)).slice(0, MAX_TASKS);
  const cats = categoryStats(items);

  root.innerHTML = html`
    ${pageHeader('ภาพรวม', `สวัสดี ${state.user.name}`)}

    <!-- ===== การ์ดสถิติ ===== -->
    <section class="grid gap-3 mb-5" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
      ${STAT_CARDS.map(([key, label, color]) => html`
        <button type="button" data-filter="${key}" class="card p-4 text-left hover:border-brand transition-colors">
          <div class="meta">${label}</div>
          <div class="text-[28px] font-bold leading-tight mt-1" style="color:${color}">${items.filter((i) => matchFilter(i, key)).length}</div>
        </button>`)}
    </section>

    <!-- ===== กราฟ ===== -->
    <section id="chart-panel" class="card mb-5"></section>

    <div class="flex flex-wrap gap-5">
      <!-- ===== งานของฉัน ===== -->
      <section class="flex-[2_1_420px] min-w-0">
        <div class="flex items-center justify-between mb-3">
          <div class="font-semibold">งานของฉัน</div>
          <a href="#/tasks" class="text-[13px]">ดูทั้งหมด</a>
        </div>
        <div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">
          ${tasks.length ? tasks.map(complaintCard) : emptyState('ไม่มีงานค้าง')}
        </div>
      </section>

      <!-- ===== ประเภทปัญหา ===== -->
      <section class="flex-[1_1_280px] card self-start">
        <div class="card-head">ประเภทปัญหาที่พบ</div>
        <div class="card-body flex flex-col gap-3">
          ${cats.length ? cats.map((c) => html`
            <div>
              <div class="flex justify-between text-[13px] mb-1"><span>${c.cat}</span><span class="font-semibold">${c.n}</span></div>
              <div class="h-1.5 rounded-full bg-line-softer overflow-hidden"><div class="h-full bg-brand rounded-full" style="width:${c.pct}%"></div></div>
            </div>`) : html`<div class="meta">ยังไม่มีข้อมูล</div>`}
        </div>
      </section>
    </div>`;

  renderChartPanel($('#chart-panel', root));

  on(root, 'click', '[data-filter]', (e, el) => {
    state.list.filter = el.dataset.filter;
    state.list.q = '';
    location.hash = '#/complaints';
  });
  on(root, 'click', '[data-open]', (e, el) => {
    location.hash = `#/complaints/${el.dataset.open}`;
  });
}
