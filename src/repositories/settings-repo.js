/**
 * ============================================================
 *  repositories/settings-repo.js — ค่าตั้งค่าอีเมลแจ้งเตือน (ตาราง settings)
 * ============================================================
 */
import { query } from '../db/pool.js';

/** key ในฐานข้อมูล <-> ชื่อ field ฝั่ง JavaScript */
const KEYS = {
  qa_email: 'qaEmail',
  qmr_email: 'qmrEmail',
  mgr_emails: 'mgrEmails', // JSON {ตำแหน่ง: อีเมล}
  cc_all: 'ccAll',
};

export async function getMailSettings() {
  const rows = await query('SELECT `key`, `value` FROM settings WHERE `key` IN (?)', [Object.keys(KEYS)]);
  const result = { qaEmail: '', qmrEmail: '', mgrEmails: {}, ccAll: '' };
  for (const { key, value } of rows) {
    result[KEYS[key]] = key === 'mgr_emails' ? safeJson(value) : value;
  }
  return result;
}

export async function saveMailSettings({ qaEmail, qmrEmail, mgrEmails, ccAll }) {
  const values = {
    qa_email: qaEmail,
    qmr_email: qmrEmail,
    mgr_emails: JSON.stringify(mgrEmails || {}),
    cc_all: ccAll || '',
  };
  for (const [key, value] of Object.entries(values)) {
    await query('INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)', [
      key,
      value,
    ]);
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text) || {};
  } catch {
    return {};
  }
}
