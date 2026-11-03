/**
 * ============================================================
 *  state.js — สถานะกลางของแอป (ผู้ใช้ที่ login + รายการข้อร้องเรียน)
 *  ทุกหน้าจออ่านจาก `state` และเรียก refreshComplaints() เมื่อข้อมูลเปลี่ยน
 * ============================================================
 */
import { complaints as api } from './api.js';

export const state = {
  user: null, // ผู้ใช้ปัจจุบัน
  items: [], // รายการข้อร้องเรียนที่ผู้ใช้เห็นได้
  loaded: false,

  // ค่าที่จำไว้ระหว่างเปลี่ยนหน้า
  list: { q: '', filter: 'all' },
  chart: { type: 'bar', gran: 'day', range: 'custom', year: new Date().getFullYear(), start: '14/01/2026', end: '25/01/2026' },
};

/** โหลดรายการใหม่จาก server */
export async function refreshComplaints() {
  const { items } = await api.list();
  state.items = items;
  state.loaded = true;
  return items;
}

export function resetState() {
  state.user = null;
  state.items = [];
  state.loaded = false;
}
