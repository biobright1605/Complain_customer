/**
 * ============================================================
 *  views/detail.js — รายละเอียดข้อร้องเรียน
 *   หัว   : เลขที่ + สถานะ + sev + วันครบกำหนด + stepper 6 ขั้น
 *   ซ้าย  : ข้อมูลเรื่อง / หลักฐานฝ่ายขาย / ผล QA / กล่อง action ตามบทบาท
 *   ขวา   : บันทึกความคืบหน้า + ปุ่มยกเลิก (ฝ่ายขาย) + timeline
 *  ปุ่มที่แสดงมาจาก `actions` ที่ server ส่งมา (server ตรวจสิทธิ์ซ้ำทุกครั้ง)
 * ============================================================
 */
import { html, $, on, options } from '../utils/dom.js';
import { fmtDate, fmtDateTime, fmtIsoDate } from '../utils/format.js';
import { refreshComplaints } from '../state.js';
import { complaints as api } from '../api.js';
import { toast, toastError } from '../ui/toast.js';
import { dueText, loading, statusPill, sevDot } from '../ui/components.js';
import { FLOW, STATUS, SEVERITY, MANAGER_POSITIONS, ALLOWED_MIME } from '/shared/constants.js';
import { dueAt, missingForReview } from '/shared/workflow.js';

/* ------------------------------------------------------------
 * ชิ้นส่วนย่อย
 * ---------------------------------------------------------- */

/** stepper 6 ขั้น (แถบแดงถึงขั้นปัจจุบัน) */
function stepper(status) {
  const idx = FLOW.indexOf(status);
  return html`
    <ol class="grid grid-cols-6 gap-1.5 mt-4" aria-label="ขั้นตอน">
      ${FLOW.map((s, i) => html`
        <li class="flex flex-col gap-1.5">
          <div class="h-1 rounded-full ${status !== 'cx' && i <= idx ? 'bg-brand' : 'bg-line'}"></div>
          <div class="text-[11px] leading-tight ${i === idx ? 'font-semibold text-ink' : 'text-ink-muted'}">${STATUS[s]}</div>
        </li>`)}
    </ol>`;
}

/** key-value */
const kv = (pairs) => html`<dl class="kv">${pairs.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v || '—'}</dd></div>`)}</dl>`;

/** รายการไฟล์แนบ (รูป = thumbnail, อื่น ๆ = กล่องนามสกุล) */
function attachmentGrid(list, canDelete) {
  if (!list.length) return html`<div class="meta">ไม่มีไฟล์แนบ</div>`;
  return html`
    <div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
      ${list.map((a) => {
        const isImg = a.mime.startsWith('image/');
        const ext = (a.filename.split('.').pop() || '').toUpperCase().slice(0, 4);
        return html`
          <div class="border border-line-soft rounded-ctl overflow-hidden flex flex-col">
            <a href="${api.attachmentUrl(a.id)}" target="_blank" rel="noopener" class="block h-24 bg-sub grid place-items-center">
              ${isImg ? html`<img src="${api.attachmentUrl(a.id)}" alt="${a.filename}" loading="lazy" class="w-full h-24 object-cover">`
                      : html`<span class="font-bold text-ink-muted">${ext}</span>`}
            </a>
            <div class="p-2 flex flex-col gap-0.5">
              <a href="${api.attachmentUrl(a.id, true)}" class="text-[12px] font-medium truncate" title="${a.filename}">${a.filename}</a>
              <span class="meta truncate">${a.uploadedBy.replace(/ \(.*\)$/, '')} · ${fmtDate(a.uploadedAt)}</span>
              ${canDelete ? html`<button type="button" data-delete-file="${a.id}" data-name="${a.filename}" class="text-[12px] text-brand-dark text-left">ลบไฟล์</button>` : ''}
            </div>
          </div>`;
      })}
    </div>`;
}

const card = (title, body, extraCls = '') => html`
  <section class="card ${extraCls}"><div class="card-head">${title}</div><div class="card-body">${body}</div></section>`;

/** ฟอร์มผล QA (แก้ไขได้เฉพาะ new/ack/inv) */
function qaForm(c, canUpload) {
  const ta = (name, label, req) => html`
    <label class="field sm:col-span-2"><span class="label ${req ? 'req' : ''}">${label}</span>
      <textarea name="${name}" rows="3" class="input">${c[name]}</textarea></label>`;
  return html`
    <form id="qa-form" class="grid gap-4 sm:grid-cols-2" novalidate>
      <label class="field sm:col-span-2"><span class="label req">ผู้จัดการที่เกี่ยวข้อง (ผู้ทบทวน)</span>
        <select name="managerPosition" class="input">${options(MANAGER_POSITIONS, c.managerPosition, { blank: '— เลือก —' })}</select></label>
      ${ta('cause', 'สาเหตุ', true)}
      ${ta('action', 'การแก้ไข', true)}
      ${ta('prevent', 'มาตรการป้องกัน', true)}
      <label class="field"><span class="label">ผู้รับผิดชอบ</span><input name="owner" class="input" value="${c.owner}"></label>
      <label class="field"><span class="label">กำหนดเสร็จ</span><input name="dueDate" type="date" class="input" value="${c.dueDate}"></label>
      ${ta('verify', 'ผลติดตาม', false)}
      <div class="sm:col-span-2 flex flex-col gap-2">
        <span class="label req">หลักฐานการแก้ไข</span>
        ${canUpload ? html`<label class="btn-outline btn-sm self-start cursor-pointer">+ แนบไฟล์
          <input id="qa-files" type="file" multiple accept="${ALLOWED_MIME.join(',')}" class="hidden"></label>` : ''}
      </div>
    </form>`;
}

/** ผล QA แบบอ่านอย่างเดียว */
const qaReadonly = (c) => kv([
  ['ผู้จัดการที่เกี่ยวข้อง', c.managerPosition],
  ['สาเหตุ', c.cause],
  ['การแก้ไข', c.action],
  ['มาตรการป้องกัน', c.prevent],
  ['ผู้รับผิดชอบ', c.owner],
  ['กำหนดเสร็จ', c.dueDate ? fmtIsoDate(c.dueDate) : ''],
  ['ผลติดตาม', c.verify],
]);

/** กล่อง action ของผู้จัดการ / QMR */
function decisionBox(title, hint, noteLabel, okAction, okLabel, backAction, backLabel) {
  return html`
    <section class="card border-brand">
      <div class="card-head">${title}</div>
      <div class="card-body flex flex-col gap-3">
        <div class="meta">${hint}</div>
        <label class="field"><span class="label">${noteLabel}</span><textarea id="decision-note" rows="3" class="input"></textarea></label>
        <div class="flex flex-wrap gap-2 justify-end">
          <button type="button" data-act="${backAction}" class="btn-outline">${backLabel}</button>
          <button type="button" data-act="${okAction}" class="btn-primary">${okLabel}</button>
        </div>
      </div>
    </section>`;
}

/** timeline ใหม่สุดอยู่บน (จุดสีน้ำเงิน = อีเมล) */
const timeline = (logs) => html`
  <ol class="flex flex-col">
    ${logs.map((l) => html`
      <li class="relative pl-5 pb-4 border-l border-line-soft last:border-transparent ml-1">
        <span class="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${l.isMail ? 'bg-info' : 'bg-brand'}"></span>
        <div class="text-[13px] ${l.isMail ? 'text-info' : ''}">${l.text}</div>
        <div class="meta">${l.by} · ${fmtDateTime(l.at)}</div>
      </li>`)}
  </ol>`;

/* ------------------------------------------------------------
 * หน้าหลัก
 * ---------------------------------------------------------- */
export async function renderDetail(root, id) {
  root.innerHTML = loading();
  let c;
  try {
    c = await api.get(id);
  } catch (err) {
    toastError(err);
    location.hash = '#/complaints';
    return;
  }

  const can = (a) => c.actions.includes(a);
  const salesFiles = c.attachments.filter((a) => a.kind === 'sales');
  const qaFiles = c.attachments.filter((a) => a.kind === 'qa');
  const qaEditable = can('saveQa');
  const showQaResult = c.cause || c.action || c.prevent || qaFiles.length || qaEditable;

  // render ลง element ใหม่ทุกครั้ง เพื่อไม่ให้ event listener ซ้อนกันเมื่อ reload
  const page = document.createElement('div');
  page.innerHTML = html`
    <a href="#/complaints" class="text-[13px]">← กลับไปรายการ</a>

    <!-- ===== หัวเรื่อง ===== -->
    <header class="card p-5 mt-3 mb-5">
      <div class="flex flex-wrap items-center gap-3">
        <h1>${c.no}</h1>${statusPill(c.status)}
        <span class="flex items-center gap-1.5 text-[13px]">${sevDot(c.sev)}${SEVERITY[c.sev]}</span>
        <span class="text-[13px] text-ink-muted">ครบกำหนด ${fmtDate(dueAt(c))} · ${dueText(c)}</span>
      </div>
      <div class="meta mt-1">แจ้งโดย ${c.salesName} · ${fmtDateTime(c.createdAt)}</div>
      ${c.status === 'cx'
        ? html`<div class="mt-3 text-[13px] bg-sub rounded-ctl px-3 py-2">ยกเลิกโดย ${c.cancel?.by} · ${c.cancel?.reason}</div>`
        : stepper(c.status)}
    </header>

    <div class="flex flex-wrap gap-5 items-start">
      <!-- ===== คอลัมน์ซ้าย ===== -->
      <div class="flex-[2_1_480px] min-w-0 flex flex-col gap-5">
        ${card('ข้อมูลเรื่อง', html`
          ${kv([
            ['ลูกค้า', c.customer], ['ผู้ติดต่อ', c.contact], ['Invoice', c.invoice], ['วันที่ส่งมอบ', fmtIsoDate(c.deliveryDate)],
            ['สินค้า', c.product], ['Lot / Batch', c.lot], ['วันที่ผลิต', fmtIsoDate(c.productionDate)], ['ขนาดบรรจุ', c.pack],
            ['จำนวนที่มีปัญหา', `${c.qty} ${c.unit}`], ['ประเภทปัญหา', c.category], ['ลูกค้าต้องการ', c.customerWant],
            ['อีเมลผู้แจ้ง', c.mailSales], ['CC', c.mailCc],
          ])}
          <div class="mt-4"><div class="meta mb-1">รายละเอียดปัญหา</div><div class="whitespace-pre-wrap">${c.detail}</div></div>`)}

        ${card('หลักฐานจากฝ่ายขาย', attachmentGrid(salesFiles, false))}

        ${showQaResult ? card('ผลการตรวจสอบ (QA)', html`
          ${qaEditable ? qaForm(c, can('qaFile')) : qaReadonly(c)}
          <div class="mt-4">${attachmentGrid(qaFiles, can('qaFile'))}</div>
          ${c.review ? html`<div class="mt-4 text-[13px] bg-sub rounded-ctl px-3 py-2">ทบทวนโดย ${c.review.by} · ${fmtDateTime(c.review.at)}${c.review.note ? ` · ${c.review.note}` : ''}</div>` : ''}
          ${c.approval ? html`<div class="mt-2 text-[13px] bg-sub rounded-ctl px-3 py-2">อนุมัติโดย ${c.approval.by} · ${fmtDateTime(c.approval.at)}${c.approval.note ? ` · ${c.approval.note}` : ''}</div>` : ''}
        `) : ''}

        <!-- ===== กล่อง action ตามบทบาท ===== -->
        ${can('ack') ? html`
          <section class="card border-brand"><div class="card-body flex flex-wrap items-center justify-between gap-3">
            <div>เรื่องใหม่ — กดรับเรื่องเพื่อแจ้งฝ่ายขายว่า QA ได้รับแล้ว</div>
            <button type="button" data-act="ack" class="btn-primary">รับเรื่อง</button>
          </div></section>` : ''}

        ${qaEditable ? html`
          <section class="card border-brand"><div class="card-body flex flex-wrap justify-end gap-2">
            <button type="button" data-act="saveQa" class="btn-outline">บันทึกร่าง</button>
            <button type="button" data-act="submitReview" class="btn-primary">ส่งให้ผู้จัดการทบทวน</button>
          </div></section>` : ''}

        ${can('review') ? decisionBox('ทบทวนโดยผู้จัดการ', 'ชื่อผู้ทบทวนบันทึกจากบัญชีที่เข้าสู่ระบบอัตโนมัติ', 'ความเห็น / เหตุผล (ต้องระบุเมื่อส่งกลับ)', 'review', 'ทบทวนแล้ว ส่งให้ QMR', 'sendBack', 'ส่งกลับ QA') : ''}
        ${can('approve') ? decisionBox('อนุมัติโดย QMR', 'ชื่อผู้อนุมัติบันทึกจากบัญชีที่เข้าสู่ระบบอัตโนมัติ', 'ความเห็น / เหตุผล (ต้องระบุเมื่อไม่อนุมัติ)', 'approve', 'อนุมัติ ปิดเรื่อง', 'reject', 'ไม่อนุมัติ ส่งกลับ') : ''}
      </div>

      <!-- ===== คอลัมน์ขวา ===== -->
      <aside class="flex-[1_1_300px] min-w-0 flex flex-col gap-5">
        ${can('note') ? card('บันทึกความคืบหน้า', html`
          <textarea id="progress-note" rows="3" class="input" placeholder="พิมพ์ข้อความ${can('cancel') ? ' หรือเหตุผลที่ยกเลิก' : ''}"></textarea>
          <div class="flex flex-wrap justify-end gap-2 mt-3">
            ${can('cancel') ? html`<button type="button" data-act="cancel" class="btn-outline">ยกเลิกเรื่อง</button>` : ''}
            <button type="button" data-act="note" class="btn-primary">เพิ่มบันทึก</button>
          </div>`) : ''}
        ${card('ไทม์ไลน์', timeline(c.logs))}
      </aside>
    </div>`;

  root.replaceChildren(page);
  bindDetailEvents(root, page, c);
}

/* ------------------------------------------------------------
 * Events
 * ---------------------------------------------------------- */
function bindDetailEvents(root, page, c) {
  const reload = async () => {
    await refreshComplaints();
    await renderDetail(root, c.id);
  };
  const qaValues = () => {
    const form = $('#qa-form', page);
    return form ? Object.fromEntries(new FormData(form).entries()) : {};
  };
  const qaFileCount = () => c.attachments.filter((a) => a.kind === 'qa').length;

  /** เรียก action แล้วแสดงผล */
  const run = async (name, body = {}) => {
    try {
      const res = await api.action(c.id, name, body);
      toast(res.message + (res.mailedTo.length ? ` · ส่งอีเมลถึง ${res.mailedTo.join(', ')}` : ''));
      await reload();
    } catch (err) {
      toastError(err);
    }
  };

  on(page, 'click', '[data-act]', async (e, el) => {
    const name = el.dataset.act;
    const decisionNote = $('#decision-note', page)?.value.trim() || '';
    const progressNote = $('#progress-note', page)?.value.trim() || '';

    switch (name) {
      case 'saveQa':
        return run(name, qaValues());
      case 'submitReview': {
        const values = qaValues();
        const missing = missingForReview(values, qaFileCount());
        if (missing.length) return toast(`ก่อนส่งทบทวน กรุณาระบุ: ${missing.join(', ')}`, 'err');
        return run(name, values);
      }
      case 'sendBack':
        if (!decisionNote) return toast('กรุณาระบุเหตุผลที่ส่งกลับ', 'err');
        return run(name, { note: decisionNote });
      case 'reject':
        if (!decisionNote) return toast('กรุณาระบุเหตุผลที่ไม่อนุมัติ', 'err');
        return run(name, { note: decisionNote });
      case 'review':
      case 'approve':
        return run(name, { note: decisionNote });
      case 'note':
        if (!progressNote) return toast('กรุณาพิมพ์ข้อความก่อน', 'err');
        return run(name, { note: progressNote });
      case 'cancel':
        if (!progressNote) return toast('กรุณาพิมพ์เหตุผลที่ยกเลิกในช่องความคืบหน้าก่อน', 'err');
        if (!window.confirm(`ยืนยันยกเลิกข้อร้องเรียน ${c.no} ?`)) return undefined;
        return run(name, { note: progressNote });
      default:
        return run(name);
    }
  });

  // ---------- QA แนบไฟล์ (บันทึกร่างก่อน เพื่อไม่ให้ข้อความที่พิมพ์ไว้หาย) ----------
  $('#qa-files', page)?.addEventListener('change', async (e) => {
    const data = new FormData();
    [...e.target.files].forEach((f) => data.append('files', f));
    try {
      await api.action(c.id, 'saveQa', qaValues());
      await api.uploadQaFiles(c.id, data);
      toast('แนบหลักฐานแล้ว');
      await reload();
    } catch (err) {
      toastError(err);
    }
  });

  // ---------- QA ลบไฟล์ ----------
  on(page, 'click', '[data-delete-file]', async (e, el) => {
    if (!window.confirm(`ลบไฟล์ ${el.dataset.name} ?`)) return;
    try {
      await api.action(c.id, 'saveQa', qaValues());
      await api.deleteAttachment(el.dataset.deleteFile);
      toast('ลบไฟล์แล้ว');
      await reload();
    } catch (err) {
      toastError(err);
    }
  });
}
