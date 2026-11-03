/**
 * ============================================================
 *  ui/toast.js — ข้อความแจ้งเตือนล่างกลางจอ (หายใน 4.2 วินาที)
 *  toast('บันทึกแล้ว')          ปกติ (พื้นเข้ม)
 *  toast('ผิดพลาด', 'err')      error (พื้นแดง)
 * ============================================================
 */
const DURATION_MS = 4200;
let timer = null;

export function toast(message, kind = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.style.background = kind === 'err' ? '#B01E25' : '#221C1B';
  el.classList.remove('hidden');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.add('hidden'), DURATION_MS);
}

/** แสดง error จาก API (หรือ error อื่น) เป็น toast สีแดง */
export const toastError = (err) => toast(err?.message || 'เกิดข้อผิดพลาด', 'err');
