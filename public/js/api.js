/**
 * ============================================================
 *  api.js — เรียก REST API ของ Back-End (ที่เดียวที่ใช้ fetch)
 *  - ใส่ header X-Requested-With ทุกครั้ง (Back-End ใช้ป้องกัน CSRF)
 *  - error จาก server จะถูก throw เป็น ApiError พร้อมข้อความภาษาไทย
 * ============================================================
 */

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/** ตัวกลางเรียก API */
async function request(method, url, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: {
      'X-Requested-With': 'fetch',
      ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
  if (!res.ok) {
    // แจ้งส่วนอื่นของแอปเมื่อ session หมดอายุ หรือต้องเปลี่ยนรหัสผ่าน
    if (res.status === 401) window.dispatchEvent(new CustomEvent('auth:expired'));
    if (data?.code === 'PASSWORD_CHANGE_REQUIRED') window.dispatchEvent(new CustomEvent('auth:change-password'));
    throw new ApiError(res.status, data?.error || 'เชื่อมต่อ server ไม่สำเร็จ', data);
  }
  return data;
}

const get = (url) => request('GET', url);
const post = (url, body) => request('POST', url, body);

/* ---------- Auth ---------- */
export const auth = {
  me: () => get('/api/auth/me'),
  login: (username, password) => post('/api/auth/login', { username, password }),
  logout: () => post('/api/auth/logout'),
  changePassword: (currentPassword, newPassword) => post('/api/auth/change-password', { currentPassword, newPassword }),
};

/* ---------- ข้อร้องเรียน ---------- */
export const complaints = {
  list: () => get('/api/complaints'),
  get: (id) => get(`/api/complaints/${id}`),
  /** formData: ช่องฟอร์ม + files[] */
  create: (formData) => post('/api/complaints', formData),
  action: (id, name, body = {}) => post(`/api/complaints/${id}/actions/${name}`, body),
  uploadQaFiles: (id, formData) => post(`/api/complaints/${id}/files`, formData),
  deleteAttachment: (attachmentId) => request('DELETE', `/api/attachments/${attachmentId}`),
  attachmentUrl: (attachmentId, download = false) => `/api/attachments/${attachmentId}${download ? '?download=1' : ''}`,
  exportUrl: (format, { filter, q }) => `/api/complaints/export?${new URLSearchParams({ format, filter, q })}`,
};

/* ---------- ตั้งค่า / ผู้ใช้ ---------- */
export const admin = {
  getMail: () => get('/api/settings/mail'),
  saveMail: (body) => request('PUT', '/api/settings/mail', body),
  listUsers: () => get('/api/users'),
  createUser: (body) => post('/api/users', body),
  updateUser: (id, body) => request('PATCH', `/api/users/${id}`, body),
  resetPassword: (id) => post(`/api/users/${id}/reset-password`),
};
