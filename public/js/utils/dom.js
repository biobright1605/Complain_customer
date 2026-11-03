/**
 * ============================================================
 *  utils/dom.js — helper สร้าง HTML อย่างปลอดภัย
 *  html`...${value}...`  ค่าที่แทรกจะถูก escape อัตโนมัติ (กัน XSS)
 *  raw(str)              ใช้เมื่อแทรก HTML ที่สร้างเองแล้ว (เช่น html`` ซ้อน)
 * ============================================================
 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ESC[ch]);

/** ห่อข้อความที่เป็น HTML แล้ว เพื่อไม่ให้ถูก escape ซ้ำ */
class RawHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}
export const raw = (value) => new RawHtml(value);

/** แปลงค่าที่แทรกใน template */
function stringify(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof RawHtml) return value.value;
  if (Array.isArray(value)) return value.map(stringify).join('');
  return escapeHtml(value);
}

/** tagged template: คืน RawHtml เพื่อซ้อนกันได้ */
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => {
    out += stringify(v) + strings[i + 1];
  });
  return raw(out);
}

/** querySelector สั้น ๆ */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * Event delegation: ผูก event ครั้งเดียวที่ root
 * on(root, 'click', '[data-action="save"]', (e, el) => ...)
 */
export function on(root, type, selector, handler) {
  root.addEventListener(type, (e) => {
    const el = e.target.closest(selector);
    if (el && root.contains(el)) handler(e, el);
  });
}

/** อ่านค่าฟอร์มทั้งหมดเป็น object (ตาม name) */
export const formValues = (form) => Object.fromEntries(new FormData(form).entries());

/** ตัวเลือก <option> */
export const options = (list, selected, { blank } = {}) =>
  html`${blank !== undefined ? html`<option value="">${blank}</option>` : ''}${list.map(
    (item) => {
      const [value, label] = Array.isArray(item) ? item : [item, item];
      return html`<option value="${value}" ${value === selected ? raw('selected') : ''}>${label}</option>`;
    },
  )}`;
