/**
 * ============================================================
 *  views/new-complaint.js — แจ้งข้อร้องเรียน (ฝ่ายขาย)
 *  เลขที่ SC-YYMMDD-NN สร้างอัตโนมัติฝั่ง server
 *  ส่วน: ข้อมูลลูกค้า / ข้อมูลสินค้า / รายละเอียดปัญหา / หลักฐาน / อีเมล
 * ============================================================
 */
import { html, $, on, options } from '../utils/dom.js';
import { fmtSize } from '../utils/format.js';
import { state, refreshComplaints } from '../state.js';
import { complaints as api } from '../api.js';
import { toast, toastError } from '../ui/toast.js';
import { pageHeader } from '../ui/components.js';
import { PRODUCTS, CATEGORIES, UNITS, SEVERITY, ALLOWED_MIME } from '/shared/constants.js';
import { isEmail, splitEmails } from '/shared/workflow.js';

/* ------------------------------------------------------------
 * นิยามฟอร์ม (แก้ลำดับ/ชื่อช่องได้ที่นี่)
 *  k=name, l=ป้าย, r=บังคับ, t=ชนิด (date|area|select), o=ตัวเลือก, full=เต็มแถว
 * ---------------------------------------------------------- */
const SECTIONS = [
  ['ข้อมูลลูกค้า', [
    { k: 'customer', l: 'ชื่อลูกค้า', r: 1 },
    { k: 'contact', l: 'ผู้ติดต่อ / เบอร์โทรลูกค้า' },
    { k: 'invoice', l: 'เลขที่ใบส่งของ / Invoice' },
    { k: 'deliveryDate', l: 'วันที่ส่งมอบ', t: 'date' },
  ]],
  ['ข้อมูลสินค้า', [
    { k: 'product', l: 'ชนิดสินค้า', r: 1, t: 'select', o: PRODUCTS, blank: '— เลือก —' },
    { k: 'lot', l: 'Lot / Batch No.', r: 1 },
    { k: 'productionDate', l: 'วันที่ผลิต', t: 'date' },
    { k: 'pack', l: 'ขนาดบรรจุ', ph: 'เช่น 50 กก./กระสอบ', value: '50 กก./กระสอบ' },
    { k: 'qty', l: 'จำนวนที่มีปัญหา', r: 1 },
    { k: 'unit', l: 'หน่วย', t: 'select', o: UNITS, value: 'กระสอบ' },
  ]],
  ['รายละเอียดปัญหา', [
    { k: 'category', l: 'ประเภทปัญหา', r: 1, t: 'select', o: CATEGORIES, blank: '— เลือก —' },
    { k: 'sev', l: 'กำหนดตอบกลับฝ่ายขาย', r: 1, t: 'select', o: Object.entries(SEVERITY), value: 'normal' },
    { k: 'customerWant', l: 'สิ่งที่ลูกค้าต้องการ', ph: 'เปลี่ยนสินค้า / คืนเงิน / ตรวจสอบ', full: 1 },
    { k: 'detail', l: 'รายละเอียดปัญหา', r: 1, t: 'area', full: 1, ph: 'อธิบายสิ่งที่ลูกค้าพบ จำนวน และสภาพสินค้า' },
  ]],
];

/** ช่องกรอก 1 ช่อง */
function field(f) {
  const cls = 'input';
  let control;
  if (f.t === 'select') control = html`<select name="${f.k}" class="${cls}">${options(f.o, f.value || '', { blank: f.blank })}</select>`;
  else if (f.t === 'area') control = html`<textarea name="${f.k}" rows="4" class="${cls}" placeholder="${f.ph || ''}"></textarea>`;
  else control = html`<input name="${f.k}" type="${f.t || 'text'}" class="${cls}" value="${f.value || ''}" placeholder="${f.ph || ''}">`;
  return html`<label class="field ${f.full ? 'sm:col-span-2' : ''}"><span class="label ${f.r ? 'req' : ''}">${f.l}</span>${control}</label>`;
}

const section = (title, body) => html`
  <section class="card"><div class="card-head">${title}</div><div class="card-body">${body}</div></section>`;

export function renderNewComplaint(root) {
  let files = []; // ไฟล์ที่เลือกไว้ (ยังไม่อัปโหลด)

  root.innerHTML = html`
    ${pageHeader('แจ้งข้อร้องเรียน', 'เลขที่ข้อร้องเรียนจะสร้างอัตโนมัติเมื่อส่ง (SC-YYMMDD-NN)')}
    <form id="new-form" class="flex flex-col gap-4 max-w-[900px]" novalidate>
      ${SECTIONS.map(([title, fields]) => section(title, html`<div class="grid gap-4 sm:grid-cols-2">${fields.map(field)}</div>`))}

      ${section('หลักฐาน (รูปภาพ / PDF)', html`
        <label class="btn-outline cursor-pointer">
          + เลือกไฟล์
          <input id="file-input" type="file" multiple accept="${ALLOWED_MIME.join(',')}" class="hidden">
        </label>
        <ul id="file-list" class="mt-3 flex flex-col gap-2"></ul>`)}

      ${section('อีเมลแจ้งเตือน', html`
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="field"><span class="label">อีเมลของฉัน (รับผลการตรวจสอบ)</span>
            <input name="mailSales" type="email" class="input" value="${state.user.email}"></label>
          <label class="field"><span class="label">CC เพิ่มเติม (คั่นด้วย , )</span>
            <input name="mailCc" class="input" placeholder="เช่น manager@surinsugar.co.th"></label>
        </div>`)}

      <div class="flex justify-end gap-2">
        <a href="#/complaints" class="btn-outline">ยกเลิก</a>
        <button type="submit" class="btn-primary">ส่งข้อร้องเรียนถึง QA</button>
      </div>
    </form>`;

  const form = $('#new-form', root);
  const fileList = $('#file-list', root);

  // ---------- รายการไฟล์ที่เลือก ----------
  const renderFiles = () => {
    fileList.innerHTML = html`${files.map((f, i) => html`
      <li class="flex items-center gap-3 border border-line-soft rounded-ctl px-3 py-2">
        <span class="flex-1 truncate">${f.name}</span><span class="meta">${fmtSize(f.size)}</span>
        <button type="button" data-remove="${i}" class="btn-ghost btn-sm">ลบ</button>
      </li>`)}`;
  };
  $('#file-input', root).addEventListener('change', (e) => {
    files = [...files, ...e.target.files];
    e.target.value = '';
    renderFiles();
  });
  on(fileList, 'click', '[data-remove]', (e, el) => {
    files.splice(Number(el.dataset.remove), 1);
    renderFiles();
  });

  // ---------- ส่งฟอร์ม ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // ตรวจเบื้องต้นฝั่งหน้าเว็บ (server ตรวจซ้ำอีกครั้ง)
    const missing = SECTIONS.flatMap(([, fs]) => fs).filter((f) => f.r && !String(form[f.k].value).trim()).map((f) => f.l);
    if (missing.length) return toast(`กรุณากรอก: ${missing.join(', ')}`, 'err');
    const badEmails = [form.mailSales.value, ...splitEmails(form.mailCc.value)].filter((m) => m && !isEmail(m));
    if (badEmails.length) return toast(`รูปแบบอีเมลไม่ถูกต้อง: ${badEmails.join(', ')}`, 'err');

    const data = new FormData(form);
    files.forEach((f) => data.append('files', f));
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const result = await api.create(data);
      toast(`ส่งข้อร้องเรียน ${result.no} แล้ว${result.mailedTo.length ? ` · ส่งอีเมลถึง ${result.mailedTo.join(', ')}` : ''}`);
      await refreshComplaints();
      location.hash = `#/complaints/${result.id}`;
    } catch (err) {
      toastError(err);
      button.disabled = false;
    }
  });
}
