/**
 * ============================================================
 *  views/login.js — หน้าเข้าสู่ระบบ
 *  ซ้าย: พื้นแดงแบรนด์ + โลโก้ + ชื่อระบบ / ขวา: ฟอร์ม (กด Enter = login)
 * ============================================================
 */
import { html, $ } from '../utils/dom.js';
import { auth } from '../api.js';
import { ROLES } from '/shared/constants.js';

export function renderLogin(root, onLoggedIn) {
  root.innerHTML = html`
    <div class="min-h-screen flex flex-wrap">
      <!-- ===== ฝั่งแบรนด์ ===== -->
      <section class="flex-[1_1_380px] bg-brand text-white p-[clamp(28px,6vw,72px)] flex flex-col justify-center gap-7">
        <div class="bg-white rounded-[14px] p-2.5 w-[200px] h-[120px] grid place-items-center overflow-hidden">
          <img src="/assets/logo-srs.jpg" alt="บริษัท น้ำตาลสุรินทร์ จำกัด" class="w-[180px] h-[100px] object-cover">
        </div>
        <div class="flex flex-col gap-2.5 max-w-[460px]">
          <div class="text-[clamp(26px,3.4vw,38px)] font-bold leading-tight">ระบบข้อร้องเรียนสินค้า (น้ำตาล)</div>
          <div class="text-[16px] opacity-90">ฝ่ายขายแจ้งปัญหาคุณภาพสินค้าถึง QA โรงงาน ผ่านการทบทวนโดยผู้จัดการและอนุมัติโดย QMR ก่อนส่งผลกลับให้ลูกค้า</div>
        </div>
        <div class="flex flex-wrap gap-2 text-[13px]">
          ${['sales', 'qa', 'mgr', 'qmr'].map((r) => html`<span class="px-3 py-1 rounded-full border border-white/55">${ROLES[r]}</span>`)}
        </div>
      </section>

      <!-- ===== ฟอร์ม ===== -->
      <section class="flex-[1_1_380px] bg-white flex items-center justify-center p-[clamp(24px,5vw,64px)]">
        <form id="login-form" class="w-full max-w-[380px] flex flex-col gap-[18px]" novalidate>
          <div>
            <div class="text-[24px] font-bold">เข้าสู่ระบบ</div>
            <div class="text-ink-muted">ใช้ชื่อผู้ใช้และรหัสผ่านที่ได้รับจากฝ่าย IT</div>
          </div>
          <label class="field">
            <span class="label">ชื่อผู้ใช้</span>
            <input name="username" class="input text-[15px] py-[11px]" autocomplete="username" required autofocus>
          </label>
          <label class="field">
            <span class="label">รหัสผ่าน</span>
            <input name="password" type="password" class="input text-[15px] py-[11px]" autocomplete="current-password" required>
          </label>
          <div id="login-error" class="hidden text-brand-dark bg-brand-err rounded-ctl px-3 py-2 text-[13px]"></div>
          <button type="submit" class="btn-primary py-3 text-[15px]">เข้าสู่ระบบ</button>
        </form>
      </section>
    </div>`;

  const form = $('#login-form', root);
  const errorBox = $('#login-error', root);

  // submit ของ <form> รองรับการกด Enter อัตโนมัติ
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    errorBox.classList.add('hidden');
    try {
      const { user } = await auth.login(form.username.value, form.password.value);
      onLoggedIn(user);
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
      form.password.value = '';
    } finally {
      button.disabled = false;
    }
  });
}
