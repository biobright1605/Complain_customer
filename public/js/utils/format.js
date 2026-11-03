/**
 * ============================================================
 *  utils/format.js — จัดรูปแบบวันที่ / ข้อความ สำหรับแสดงผล
 * ============================================================
 */

const p2 = (n) => String(n).padStart(2, '0');

/** 3 พ.ย. 69 */
export const fmtDate = (ms) =>
  ms ? new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

/** 3 พ.ย. 69 14:05 */
export const fmtDateTime = (ms) =>
  ms
    ? new Date(ms).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

/** 'YYYY-MM-DD' (จาก DB) -> 3 พ.ย. 69 */
export const fmtIsoDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return fmtDate(new Date(y, m - 1, d).getTime());
};

/** DD/MM/YYYY (ค.ศ.) */
export const fmtDmy = (d) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;

/** แปลง 'DD/MM/YYYY' -> Date (null ถ้าผิดรูปแบบ หรือวันที่ไม่มีจริง) */
export function parseDmy(text) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text || '').trim());
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  return d.getDate() === +m[1] && d.getMonth() === +m[2] - 1 ? d : null;
}

/** อักษรแรกของชื่อ (avatar) ตัดคำนำหน้า */
export const initial = (name) => (name || '?').replace(/^(ดร\.|นาย|นาง|น\.ส\.)/, '').trim().charAt(0);

/** ขนาดไฟล์ */
export const fmtSize = (bytes) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`);
