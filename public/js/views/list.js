/**
 * ============================================================
 *  views/list.js — ข้อร้องเรียนทั้งหมด
 *   - ค้นหา (เลขที่/ลูกค้า/Lot/ผู้แจ้ง/สินค้า/ประเภท)
 *   - chip filter พร้อมจำนวน
 *   - Desktop: ตาราง / Mobile: การ์ด
 *   - ส่งออกไฟล์ ▾ : Excel (.xlsx) / CSV — เฉพาะแถวตาม filter + ค้นหา
 * ============================================================
 */
import { html, $, on } from '../utils/dom.js';
import { fmtDate } from '../utils/format.js';
import { state } from '../state.js';
import { complaints as api } from '../api.js';
import { complaintCard, dueCell, emptyState, pageHeader, statusPill } from '../ui/components.js';
import { LIST_FILTERS } from '/shared/constants.js';
import { applyListFilter, matchFilter, matchSearch } from '/shared/workflow.js';

/** แถวของตาราง (desktop) */
const tableRow = (c) => html`
  <tr data-open="${c.id}" class="${c.status === 'cx' ? 'opacity-60' : ''}">
    <td><div class="font-semibold whitespace-nowrap">${c.no}</div><div class="meta">${fmtDate(c.createdAt)}</div></td>
    <td class="max-w-[220px]">${c.customer}</td>
    <td><div>${c.product}</div><div class="meta">Lot ${c.lot} · ${c.qty} ${c.unit}</div></td>
    <td>${c.category}</td>
    <td>${dueCell(c)}</td>
    <td class="whitespace-nowrap">${c.salesName}</td>
    <td>${statusPill(c.status)}</td>
  </tr>`;

/** render เฉพาะส่วนผลลัพธ์ (เรียกซ้ำเมื่อพิมพ์ค้นหา/เปลี่ยน filter) */
function renderResults(root) {
  const { q, filter } = state.list;
  const searched = state.items.filter((c) => matchSearch(c, q));
  const rows = applyListFilter(state.items, { q, filter });

  $('#chips', root).innerHTML = html`${LIST_FILTERS.map(([key, label]) => html`
    <button type="button" data-chip="${key}" class="chip ${filter === key ? 'chip-active' : ''}">
      ${label}<span class="${filter === key ? 'opacity-90' : 'text-ink-muted'}">${searched.filter((c) => matchFilter(c, key)).length}</span>
    </button>`)}`;

  $('#results', root).innerHTML = rows.length
    ? html`
      <div class="hidden md:block card overflow-x-auto">
        <table class="tbl">
          <thead><tr><th>เลขที่</th><th>ลูกค้า</th><th>สินค้า</th><th>ประเภท</th><th>กำหนดตอบ</th><th>ผู้แจ้ง</th><th>สถานะ</th></tr></thead>
          <tbody>${rows.map(tableRow)}</tbody>
        </table>
      </div>
      <div class="md:hidden grid gap-3">${rows.map(complaintCard)}</div>`
    : emptyState('ไม่พบข้อร้องเรียนตามเงื่อนไข');
}

/** dropdown ส่งออกไฟล์ */
const exportMenu = html`
  <div class="relative" id="export">
    <button type="button" data-action="toggle-export" class="btn-outline" aria-haspopup="menu">ส่งออกไฟล์ ▾</button>
    <div id="export-menu" class="hidden absolute right-0 mt-1 w-48 card shadow-pop py-1 z-20" role="menu">
      <button type="button" data-export="xlsx" class="w-full text-left px-4 py-2 hover:bg-hover" role="menuitem">Excel (.xlsx)</button>
      <button type="button" data-export="csv" class="w-full text-left px-4 py-2 hover:bg-hover" role="menuitem">CSV (UTF-8)</button>
    </div>
  </div>`;

export function renderList(root) {
  root.innerHTML = html`
    ${pageHeader('ข้อร้องเรียนทั้งหมด', '', exportMenu)}
    <div class="flex flex-col gap-3 mb-4">
      <input id="search" type="search" value="${state.list.q}" class="input max-w-[480px]"
             placeholder="ค้นหาเลขที่ ลูกค้า Lot ผู้แจ้ง สินค้า หรือประเภทปัญหา">
      <div id="chips" class="flex flex-wrap gap-2"></div>
    </div>
    <div id="results"></div>`;

  renderResults(root);

  // ---------- events ----------
  $('#search', root).addEventListener('input', (e) => {
    state.list.q = e.target.value;
    renderResults(root);
  });
  on(root, 'click', '[data-chip]', (e, el) => {
    state.list.filter = el.dataset.chip;
    renderResults(root);
  });
  on(root, 'click', '[data-open]', (e, el) => {
    location.hash = `#/complaints/${el.dataset.open}`;
  });

  const menu = $('#export-menu', root);
  on(root, 'click', '[data-action="toggle-export"]', () => menu.classList.toggle('hidden'));
  on(root, 'click', '[data-export]', (e, el) => {
    menu.classList.add('hidden');
    // ดาวน์โหลดผ่าน URL (server สร้างไฟล์ตาม filter เดียวกัน)
    window.location.href = api.exportUrl(el.dataset.export, state.list);
  });
  // คลิกนอกเมนู -> ปิดเมนู (ลบ listener อัตโนมัติเมื่อเปลี่ยนหน้า)
  const closeOutside = (e) => {
    if (!e.target.closest('#export')) menu.classList.add('hidden');
  };
  document.addEventListener('click', closeOutside);
  window.addEventListener('hashchange', () => document.removeEventListener('click', closeOutside), { once: true });
}
