/**
 * ============================================================
 *  views/settings.js — ตั้งค่า (admin, qa, qmr)
 *   1) อีเมลผู้รับแต่ละขั้น + CC ทุกเรื่อง   — admin / qa / qmr แก้ได้
 *   2) ผู้ใช้และสิทธิ์                        — admin / qa แก้ได้, qmr ดูอย่างเดียว
 *      เปลี่ยน role (+ตำแหน่งถ้าเป็น mgr), เปิด/ปิดบัญชี, รีเซ็ตรหัสผ่าน, เพิ่มผู้ใช้
 *      (แก้บัญชีของตัวเองไม่ได้)
 * ============================================================
 */
import { html, $, on, options, formValues } from '../utils/dom.js';
import { state } from '../state.js';
import { admin as api } from '../api.js';
import { toast, toastError } from '../ui/toast.js';
import { loading, pageHeader } from '../ui/components.js';
import { ROLES, MANAGER_POSITIONS } from '/shared/constants.js';
import { canManageUsers } from '/shared/workflow.js';

const ROLE_OPTIONS = Object.entries(ROLES);

/* ------------------------------------------------------------
 * ส่วนอีเมล
 * ---------------------------------------------------------- */
const mailSection = (m) => html`
  <section class="card">
    <div class="card-head">อีเมลผู้รับแจ้งเตือนแต่ละขั้น</div>
    <form id="mail-form" class="card-body grid gap-4 sm:grid-cols-2" novalidate>
      <label class="field"><span class="label">QA โรงงาน (เรื่องใหม่ / ส่งกลับ / ยกเลิก)</span>
        <input name="qaEmail" type="email" class="input" value="${m.qaEmail}"></label>
      <label class="field"><span class="label">QMR (รออนุมัติ)</span>
        <input name="qmrEmail" type="email" class="input" value="${m.qmrEmail}"></label>
      ${MANAGER_POSITIONS.map((p) => html`
        <label class="field"><span class="label">${p} (รอทบทวน)</span>
          <input name="mgr:${p}" type="email" class="input" value="${m.mgrEmails?.[p] || ''}"></label>`)}
      <label class="field sm:col-span-2"><span class="label">CC ทุกเรื่อง (คั่นด้วย , )</span>
        <input name="ccAll" class="input" value="${m.ccAll}"></label>
      <div class="sm:col-span-2 flex justify-end"><button type="submit" class="btn-primary">บันทึกการตั้งค่าอีเมล</button></div>
    </form>
  </section>`;

/* ------------------------------------------------------------
 * ส่วนผู้ใช้
 * ---------------------------------------------------------- */
function userRow(u, editable) {
  const self = u.id === state.user.id;
  const canEdit = editable && !self;
  return html`
    <tr class="${u.active ? '' : 'opacity-60'}" data-user="${u.id}">
      <td><div class="font-semibold">${u.username}</div>${self ? html`<div class="meta">(บัญชีของคุณ)</div>` : ''}</td>
      <td><div>${u.name}</div><div class="meta">${u.email}</div></td>
      <td>${canEdit
        ? html`<select data-field="role" class="input py-1.5">${options(ROLE_OPTIONS, u.role)}</select>`
        : ROLES[u.role]}</td>
      <td>${canEdit && u.role === 'mgr'
        ? html`<select data-field="position" class="input py-1.5">${options(MANAGER_POSITIONS, u.position)}</select>`
        : u.position}</td>
      <td>${canEdit
        ? html`<label class="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" data-field="active" ${u.active ? 'checked' : ''}> ใช้งาน</label>`
        : u.active ? 'ใช้งาน' : 'ปิด'}</td>
      <td>${canEdit ? html`<button type="button" data-reset="${u.id}" data-name="${u.username}" class="btn-ghost btn-sm">รีเซ็ตรหัส</button>` : ''}</td>
    </tr>`;
}

const addUserForm = () => html`
  <form id="add-user" class="card-body grid gap-3 sm:grid-cols-5 items-end border-t border-line-soft" novalidate>
    <label class="field"><span class="label req">ชื่อผู้ใช้</span><input name="username" class="input" autocomplete="off"></label>
    <label class="field"><span class="label req">ชื่อ-นามสกุล</span><input name="name" class="input"></label>
    <label class="field"><span class="label req">อีเมล</span><input name="email" type="email" class="input"></label>
    <label class="field"><span class="label">บทบาท</span>
      <select name="role" class="input">${options(ROLE_OPTIONS, 'sales')}</select></label>
    <label class="field" id="new-position"><span class="label">ตำแหน่ง (ผู้จัดการ)</span>
      <select name="position" class="input">${options(MANAGER_POSITIONS, MANAGER_POSITIONS[0])}</select></label>
    <div class="sm:col-span-5 flex justify-end"><button type="submit" class="btn-primary">+ เพิ่มผู้ใช้</button></div>
  </form>`;

const usersSection = (users, editable) => html`
  <section class="card">
    <div class="card-head">ผู้ใช้และสิทธิ์ ${editable ? '' : html`<span class="meta font-normal">ดูอย่างเดียว</span>`}</div>
    <div class="overflow-x-auto">
      <table class="tbl">
        <thead><tr><th>ชื่อผู้ใช้</th><th>ชื่อ / อีเมล</th><th>บทบาท</th><th>ตำแหน่ง</th><th>สถานะ</th><th></th></tr></thead>
        <tbody>${users.map((u) => userRow(u, editable))}</tbody>
      </table>
    </div>
    ${editable ? addUserForm() : ''}
  </section>`;

/** แสดงรหัสผ่านชั่วคราวให้ผู้ดูแลจดไว้ (แสดงครั้งเดียว) */
const showTempPassword = (username, password) =>
  window.alert(`รหัสผ่านชั่วคราวของ ${username}:\n\n${password}\n\nกรุณาแจ้งผู้ใช้ — ระบบจะบังคับเปลี่ยนรหัสเมื่อเข้าสู่ระบบครั้งแรก`);

/* ------------------------------------------------------------
 * หน้าหลัก
 * ---------------------------------------------------------- */
export async function renderSettings(root) {
  root.innerHTML = loading();
  const editable = canManageUsers(state.user);
  let mail;
  let users;
  try {
    [mail, { items: users }] = await Promise.all([api.getMail(), api.listUsers()]);
  } catch (err) {
    toastError(err);
    return;
  }

  const page = document.createElement('div');
  page.innerHTML = html`
    ${pageHeader('ตั้งค่า', 'อีเมลแจ้งเตือนอัตโนมัติ และสิทธิ์ผู้ใช้งาน')}
    <div class="flex flex-col gap-5">${mailSection(mail)}${usersSection(users, editable)}</div>`;
  root.replaceChildren(page);

  const reload = () => renderSettings(root);

  // ---------- บันทึกอีเมล ----------
  $('#mail-form', page).addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = formValues(e.target);
    const body = {
      qaEmail: v.qaEmail,
      qmrEmail: v.qmrEmail,
      ccAll: v.ccAll,
      mgrEmails: Object.fromEntries(MANAGER_POSITIONS.map((p) => [p, v[`mgr:${p}`]])),
    };
    try {
      const res = await api.saveMail(body);
      toast(res.message);
    } catch (err) {
      toastError(err);
    }
  });

  if (!editable) return;

  // ---------- แก้ role / ตำแหน่ง / เปิด-ปิด ----------
  on(page, 'change', '[data-field]', async (e, el) => {
    const row = el.closest('[data-user]');
    const id = Number(row.dataset.user);
    const role = $('[data-field="role"]', row).value;
    const body = el.dataset.field === 'active' ? { active: el.checked } : { role, position: $('[data-field="position"]', row)?.value || MANAGER_POSITIONS[0] };
    try {
      await api.updateUser(id, body);
      toast(el.dataset.field === 'active' ? (el.checked ? 'เปิดใช้งานบัญชีแล้ว' : 'ปิดใช้งานบัญชีแล้ว') : `เปลี่ยนสิทธิ์เป็น ${ROLES[role]} แล้ว`);
      reload();
    } catch (err) {
      toastError(err);
      reload();
    }
  });

  // ---------- รีเซ็ตรหัสผ่าน ----------
  on(page, 'click', '[data-reset]', async (e, el) => {
    if (!window.confirm(`รีเซ็ตรหัสผ่านของ ${el.dataset.name} ?`)) return;
    try {
      const { tempPassword } = await api.resetPassword(el.dataset.reset);
      showTempPassword(el.dataset.name, tempPassword);
    } catch (err) {
      toastError(err);
    }
  });

  // ---------- เพิ่มผู้ใช้ ----------
  const addForm = $('#add-user', page);
  const positionField = $('#new-position', page);
  const togglePosition = () => positionField.classList.toggle('hidden', addForm.role.value !== 'mgr');
  addForm.role.addEventListener('change', togglePosition);
  togglePosition();

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = formValues(addForm);
    if (!v.username.trim() || !v.name.trim() || !v.email.trim()) {
      toast('กรุณากรอกชื่อผู้ใช้ ชื่อ-นามสกุล และอีเมล', 'err');
      return;
    }
    try {
      const { tempPassword } = await api.createUser(v);
      toast(`เพิ่มผู้ใช้ ${v.username} แล้ว`);
      showTempPassword(v.username, tempPassword);
      reload();
    } catch (err) {
      toastError(err);
    }
  });
}
