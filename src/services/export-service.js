/**
 * ============================================================
 *  services/export-service.js — ส่งออกรายการเป็น Excel (.xlsx) / CSV
 *  - ส่งออกเฉพาะแถวตาม filter + คำค้น (เหมือนที่เห็นบนหน้าจอ)
 *  - หัวคอลัมน์ภาษาไทย
 *  - xlsx: หัวตารางพื้นแดงตัวขาว Tahoma, freeze แถวแรก
 *  - csv : UTF-8 BOM (เปิดใน Excel แล้วภาษาไทยไม่เพี้ยน)
 * ============================================================
 */
import ExcelJS from 'exceljs';
import { EXPORT_COLUMNS, STATUS, SEVERITY } from '../../shared/constants.js';
import { applyListFilter } from '../../shared/workflow.js';
import { listForUser } from './complaint-service.js';

const p2 = (n) => String(n).padStart(2, '0');

/** วันที่สำหรับไฟล์: DD/MM/YYYY HH:mm (เวลาไทย) */
function formatDateTime(ms) {
  const d = new Date(ms);
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** ค่าในแต่ละช่อง (แปลง key เป็นข้อความภาษาไทย) */
function cellValue(c, key) {
  if (key === 'createdAt') return formatDateTime(c.createdAt);
  if (key === 'status') return STATUS[c.status];
  if (key === 'sev') return SEVERITY[c.sev];
  return c[key] ?? '';
}

/** ชื่อไฟล์: sugar-complaints-YYYYMMDD.xlsx */
export function exportFileName(format, now = new Date()) {
  return `sugar-complaints-${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}.${format}`;
}

async function buildRows(user, filter) {
  const list = applyListFilter(await listForUser(user), filter);
  return list.map((c) => EXPORT_COLUMNS.map(([key]) => cellValue(c, key)));
}

export async function exportXlsx(user, filter) {
  const rows = await buildRows(user, filter);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('ข้อร้องเรียน', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = EXPORT_COLUMNS.map(([key, header, width]) => ({ key, header, width }));
  ws.addRows(rows);

  // ---------- สไตล์ ----------
  ws.eachRow((row, i) => {
    row.font = { name: 'Tahoma', size: 11, ...(i === 1 ? { bold: true, color: { argb: 'FFFFFFFF' } } : {}) };
    row.alignment = { vertical: 'top', wrapText: i > 1 };
  });
  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD7262E' } };
  });

  return wb.xlsx.writeBuffer();
}

export async function exportCsv(user, filter) {
  const rows = await buildRows(user, filter);
  const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [EXPORT_COLUMNS.map(([, header]) => header), ...rows].map((r) => r.map(quote).join(','));
  return Buffer.from(`﻿${lines.join('\r\n')}`, 'utf8');
}
