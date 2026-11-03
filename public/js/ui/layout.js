/**
 * ============================================================
 *  ui/layout.js — โครงหน้าหลังเข้าสู่ระบบ
 *   - Desktop (>= 760px): เมนูซ้ายกว้าง 256px (fixed)
 *   - Mobile  (< 760px) : header บน + bottom nav (สูง >= 56px)
 *  เนื้อหาของแต่ละหน้าจะถูก render ลงใน <main id="view">
 * ============================================================
 */
import { html } from '../utils/dom.js';
import { initial } from '../utils/format.js';
import { ROLES } from '/shared/constants.js';
import { canOpenSettings, tasksFor } from '/shared/workflow.js';
import { state } from '../state.js';

// ---------- ไอคอน (SVG เส้น 1.8px) ----------
const ICON_PATHS = {
  dash: 'M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z',
  tasks: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  new: 'M12 5v14M5 12h14',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  key: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
};
export const icon = (name, cls = 'w-5 h-5') => html`
  <svg class="${cls} shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[name]}"/></svg>`;

/** เมนูตามบทบาท */
function menuItems(user) {
  const items = [
    { key: 'dash', href: '#/dashboard', label: 'ภาพรวม', short: 'ภาพรวม' },
    { key: 'tasks', href: '#/tasks', label: 'งานของฉัน', short: 'งาน', badge: tasksFor(user, state.items).length },
    { key: 'list', href: '#/complaints', label: 'ข้อร้องเรียนทั้งหมด', short: 'ทั้งหมด' },
  ];
  if (user.role === 'sales') items.push({ key: 'new', href: '#/complaints/new', label: 'แจ้งข้อร้องเรียน', short: 'แจ้งเรื่อง' });
  if (canOpenSettings(user)) items.push({ key: 'settings', href: '#/settings', label: 'ตั้งค่า', short: 'ตั้งค่า' });
  return items;
}

const current = (active, key) => (active === key ? 'page' : 'false');

/**
 * render โครงหน้า
 * @param {HTMLElement} root
 * @param {string} active  key ของเมนูที่เลือก
 */
export function renderLayout(root, active) {
  const user = state.user;
  const items = menuItems(user);

  root.innerHTML = html`
    <!-- ===== Sidebar (desktop) ===== -->
    <aside class="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col bg-white border-r border-line z-30">
      <div class="px-5 pt-5 pb-4 flex items-center gap-3 border-b border-line-soft">
        <div class="w-14 h-10 rounded-ctl overflow-hidden border border-line-soft bg-white shrink-0">
          <img src="/assets/logo-srs.jpg" alt="บริษัท น้ำตาลสุรินทร์ จำกัด" class="w-full h-full object-cover">
        </div>
        <div class="leading-tight">
          <div class="font-bold text-[14px]">ระบบข้อร้องเรียนสินค้า</div>
          <div class="meta">บริษัท น้ำตาลสุรินทร์ จำกัด</div>
        </div>
      </div>
      <nav class="flex-1 p-3 flex flex-col gap-1" aria-label="เมนูหลัก">
        ${items.map((it) => html`
          <a href="${it.href}" class="nav-item" aria-current="${current(active, it.key)}">
            ${icon(it.key)}<span class="flex-1">${it.label}</span>
            ${it.badge ? html`<span class="badge">${it.badge}</span>` : ''}
          </a>`)}
      </nav>
      <div class="p-3 border-t border-line-soft">
        <div class="flex items-center gap-3 px-2 py-2">
          <div class="w-9 h-9 rounded-full bg-brand-soft text-brand-dark grid place-items-center font-bold">${initial(user.name)}</div>
          <div class="min-w-0 flex-1 leading-tight">
            <div class="font-semibold truncate">${user.name}</div>
            <div class="meta truncate">${user.position || ROLES[user.role]}</div>
          </div>
        </div>
        <a href="#/change-password" class="nav-item text-[13px]">${icon('key', 'w-4 h-4')}เปลี่ยนรหัสผ่าน</a>
        <button type="button" data-action="logout" class="nav-item w-full text-[13px]">${icon('logout', 'w-4 h-4')}ออกจากระบบ</button>
      </div>
    </aside>

    <!-- ===== Header (mobile) ===== -->
    <header class="md:hidden sticky top-0 z-30 bg-white border-b border-line flex items-center gap-3 px-4 h-14">
      <img src="/assets/logo-srs.jpg" alt="" class="w-10 h-8 rounded object-cover">
      <div class="flex-1 font-bold truncate">ระบบข้อร้องเรียนสินค้า</div>
      <a href="#/change-password" class="btn-ghost btn-sm" aria-label="เปลี่ยนรหัสผ่าน">${icon('key', 'w-4 h-4')}</a>
      <button type="button" data-action="logout" class="btn-ghost btn-sm" aria-label="ออกจากระบบ">${icon('logout', 'w-4 h-4')}</button>
    </header>

    <!-- ===== เนื้อหา ===== -->
    <div class="md:pl-64 pb-20 md:pb-0">
      <main id="view" class="max-w-content mx-auto px-[clamp(14px,3vw,36px)] py-6"></main>
    </div>

    <!-- ===== Bottom nav (mobile) ===== -->
    <nav class="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-line flex" aria-label="เมนูหลัก">
      ${items.map((it) => html`
        <a href="${it.href}" aria-current="${current(active, it.key)}"
           class="relative flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-[11px] ${active === it.key ? 'text-brand font-semibold' : 'text-ink-muted'}">
          ${icon(it.key)}${it.short}
          ${it.badge ? html`<span class="badge absolute top-1 left-1/2 ml-2">${it.badge}</span>` : ''}
        </a>`)}
    </nav>`;

  return root.querySelector('#view');
}
