/**
 * ============================================================
 *  main.js — จุดเริ่มต้นหน้าเว็บ + router (hash-based)
 *
 *  เส้นทาง:
 *    #/dashboard          ภาพรวม
 *    #/tasks              งานของฉัน
 *    #/complaints         ข้อร้องเรียนทั้งหมด
 *    #/complaints/new     แจ้งข้อร้องเรียน (ฝ่ายขาย)
 *    #/complaints/:id     รายละเอียด
 *    #/settings           ตั้งค่า
 *    #/change-password    เปลี่ยนรหัสผ่าน
 *  ยังไม่ login -> หน้า login เสมอ
 * ============================================================
 */
import { auth } from './api.js';
import { state, refreshComplaints, resetState } from './state.js';
import { on } from './utils/dom.js';
import { toastError } from './ui/toast.js';
import { loading } from './ui/components.js';
import { renderLayout } from './ui/layout.js';
import { renderLogin } from './views/login.js';
import { renderChangePassword } from './views/change-password.js';
import { renderDashboard } from './views/dashboard.js';
import { renderList } from './views/list.js';
import { renderTasks } from './views/tasks.js';
import { renderNewComplaint } from './views/new-complaint.js';
import { renderDetail } from './views/detail.js';
import { renderSettings } from './views/settings.js';
import { canOpenSettings } from '/shared/workflow.js';

const app = document.getElementById('app');

/* ------------------------------------------------------------
 * ตารางเส้นทาง: [regex, เมนูที่ active, ฟังก์ชัน render, เงื่อนไขสิทธิ์]
 * ---------------------------------------------------------- */
const ROUTES = [
  [/^#\/dashboard$/, 'dash', renderDashboard],
  [/^#\/tasks$/, 'tasks', renderTasks],
  [/^#\/complaints$/, 'list', renderList],
  [/^#\/complaints\/new$/, 'new', renderNewComplaint, (u) => u.role === 'sales'],
  [/^#\/complaints\/(\d+)$/, 'list', renderDetail],
  [/^#\/settings$/, 'settings', renderSettings, canOpenSettings],
  [/^#\/change-password$/, '', renderChangePassword],
];

/** ไปหน้าอื่น */
export const navigate = (hash) => {
  if (location.hash === hash) route();
  else location.hash = hash;
};

/** render ตาม hash ปัจจุบัน */
async function route() {
  // ---------- ยังไม่ login ----------
  if (!state.user) {
    renderLogin(app, onLoggedIn);
    return;
  }
  // ---------- ต้องเปลี่ยนรหัสผ่านครั้งแรก ----------
  if (state.user.mustChangePassword) {
    renderChangePassword(app, { forced: true, onDone: onPasswordChanged });
    return;
  }

  const hash = location.hash || '#/dashboard';
  const match = ROUTES.find(([re, , , allow]) => re.test(hash) && (!allow || allow(state.user)));
  if (!match) {
    navigate('#/dashboard');
    return;
  }
  const [re, menu, render] = match;
  const params = hash.match(re).slice(1);

  try {
    if (!state.loaded) {
      app.innerHTML = loading();
      await refreshComplaints();
    }
    const view = renderLayout(app, menu);
    await render(view, ...params);
    window.scrollTo(0, 0);
  } catch (err) {
    toastError(err);
  }
}

/* ------------------------------------------------------------
 * เหตุการณ์ login / logout
 * ---------------------------------------------------------- */
function onLoggedIn(user) {
  state.user = user;
  navigate('#/dashboard');
}

async function onPasswordChanged() {
  const { user } = await auth.me();
  state.user = user;
  navigate('#/dashboard');
}

async function logout() {
  await auth.logout().catch(() => {});
  resetState();
  history.replaceState(null, '', '#/');
  route();
}

/* ------------------------------------------------------------
 * เริ่มต้นแอป
 * ---------------------------------------------------------- */
async function start() {
  try {
    const { user } = await auth.me();
    state.user = user;
  } catch {
    state.user = null;
  }

  window.addEventListener('hashchange', route);
  // session หมดอายุ -> กลับหน้า login
  window.addEventListener('auth:expired', () => {
    if (state.user) {
      resetState();
      route();
    }
  });
  // ปุ่มออกจากระบบ (อยู่ใน layout)
  on(document, 'click', '[data-action="logout"]', logout);

  route();
}

start();
