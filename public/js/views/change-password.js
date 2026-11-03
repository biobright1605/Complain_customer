/**
 * ============================================================
 *  views/change-password.js — เปลี่ยนรหัสผ่าน
 *  forced=true : บังคับเปลี่ยนครั้งแรก (แสดงเต็มจอ ไม่มีเมนู)
 *  forced=false: เปิดจากเมนู (แสดงในโครงหน้าปกติ)
 * ============================================================
 */
import { html, $ } from '../utils/dom.js';
import { auth } from '../api.js';
import { toast } from '../ui/toast.js';

const MIN_LENGTH = 8;

export function renderChangePassword(root, { forced = false, onDone } = {}) {
  root.innerHTML = html`
    <div class="${forced ? 'min-h-screen grid place-items-center p-4' : ''}">
      <form id="pw-form" class="card w-full max-w-[420px] p-6 flex flex-col gap-4" novalidate>
        <div>
          <h1>เปลี่ยนรหัสผ่าน</h1>
          ${forced ? html`<div class="text-ink-muted mt-1">กรุณาตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งาน</div>` : ''}
        </div>
        <label class="field"><span class="label">รหัสผ่านปัจจุบัน</span>
          <input name="current" type="password" class="input" autocomplete="current-password" required></label>
        <label class="field"><span class="label">รหัสผ่านใหม่ (อย่างน้อย ${MIN_LENGTH} ตัวอักษร)</span>
          <input name="next" type="password" class="input" autocomplete="new-password" required></label>
        <label class="field"><span class="label">ยืนยันรหัสผ่านใหม่</span>
          <input name="confirm" type="password" class="input" autocomplete="new-password" required></label>
        <div id="pw-error" class="hidden text-brand-dark bg-brand-err rounded-ctl px-3 py-2 text-[13px]"></div>
        <div class="flex gap-2 justify-end">
          ${forced ? html`<button type="button" data-action="logout" class="btn-outline">ออกจากระบบ</button>` : ''}
          <button type="submit" class="btn-primary">บันทึกรหัสผ่าน</button>
        </div>
      </form>
    </div>`;

  const form = $('#pw-form', root);
  const errorBox = $('#pw-error', root);
  const showError = (msg) => {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { current, next, confirm } = form;
    if (next.value.length < MIN_LENGTH) return showError(`รหัสผ่านใหม่ต้องยาวอย่างน้อย ${MIN_LENGTH} ตัวอักษร`);
    if (next.value !== confirm.value) return showError('ยืนยันรหัสผ่านไม่ตรงกัน');
    try {
      await auth.changePassword(current.value, next.value);
      toast('เปลี่ยนรหัสผ่านแล้ว');
      form.reset();
      if (onDone) onDone();
    } catch (err) {
      showError(err.message);
    }
  });
}
