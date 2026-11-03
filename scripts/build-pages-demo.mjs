/**
 * ============================================================
 *  scripts/build-pages-demo.mjs — สร้างเวอร์ชันทดลอง (static) สำหรับ GitHub Pages
 *  ใช้:  npm run build:css && node scripts/build-pages-demo.mjs
 *  ผลลัพธ์: โฟลเดอร์ dist-pages/
 *   - คัดลอก public/ + shared/ + Chart.js
 *   - แทน js/api.js ด้วย demo/api.js (Back-End จำลองใน localStorage)
 *   - แปลง path แบบ "/xxx" เป็น path สัมพัทธ์ (เว็บอยู่ใต้ /<ชื่อ repo>/)
 *   - เพิ่มแถบ "โหมดทดลอง" บอกบัญชีทดลอง
 * ============================================================
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist-pages');

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });
fs.cpSync(path.join(ROOT, 'shared'), path.join(OUT, 'shared'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'vendor/chart.js'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'node_modules/chart.js/dist/chart.umd.js'), path.join(OUT, 'vendor/chart.js/chart.umd.js'));
fs.copyFileSync(path.join(ROOT, 'demo/api.js'), path.join(OUT, 'js/api.js'));
fs.rmSync(path.join(OUT, 'css/tailwind.src.css'), { force: true });
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

/** ไฟล์ทั้งหมดในโฟลเดอร์ */
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name);
  return d.isDirectory() ? walk(p) : [p];
});

// ---------- แปลง import '/shared/...' เป็น path สัมพัทธ์ของแต่ละไฟล์ ----------
for (const file of walk(OUT).filter((f) => f.endsWith('.js') && !f.includes('vendor'))) {
  let src = fs.readFileSync(file, 'utf8');
  let rel = path.relative(path.dirname(file), OUT).split(path.sep).join('/') || '.';
  if (!rel.startsWith('.')) rel = `./${rel}`;
  src = src.replace(/(from\s+|import\s*\(\s*)(['"])\/shared\//g, `$1$2${rel}/shared/`);
  // รูป/ลิงก์ใน HTML template อ้างอิงจากตำแหน่งหน้าเว็บ (index.html) จึงใช้ ./
  src = src.replace(/(['"])\/assets\//g, '$1./assets/');
  fs.writeFileSync(file, src);
}

// ---------- index.html ----------
const BANNER = `
  <style>
    #demo-banner{position:fixed;right:12px;bottom:12px;z-index:70;max-width:min(340px,calc(100vw - 24px));background:#FFF4D6;color:#5A3E00;font-size:13px;line-height:1.55;border:1px solid #E5C46A;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.12)}
    #demo-banner summary{cursor:pointer;padding:8px 14px;font-weight:700;list-style:none}
    #demo-banner summary::-webkit-details-marker{display:none}
    #demo-banner summary::after{content:' ▾';font-weight:400}
    #demo-banner[open] summary::after{content:' ▴'}
    #demo-banner .body{padding:0 14px 12px;display:flex;flex-direction:column;gap:6px}
    #demo-banner code{background:#fff;border-radius:4px;padding:0 4px}
    #demo-banner button{align-self:flex-start;border:1px solid #C9A64A;border-radius:6px;padding:2px 10px;background:#fff;cursor:pointer}
    @media (max-width:759px){#demo-banner{bottom:76px}}
  </style>
  <details id="demo-banner" open>
    <summary>เวอร์ชันทดลอง (Demo)</summary>
    <div class="body">
      <div>บัญชีทดลอง (รหัสผ่าน <code>1234</code> ทุกบัญชี):<br>
        <code>sales</code> <code>sales2</code> ฝ่ายขาย · <code>qa</code> QA ·
        <code>mgr</code> <code>mgr2</code> <code>mgr3</code> ผู้จัดการ · <code>qmr</code> QMR · <code>admin</code></div>
      <div>ข้อมูลเก็บในเบราว์เซอร์ของคุณเท่านั้น (ไม่แชร์กับผู้อื่น) และไม่ส่งอีเมลจริง</div>
      <button type="button" onclick="if(confirm('ล้างข้อมูลทดลองทั้งหมดและเริ่มใหม่?')){window.__resetDemo&&window.__resetDemo();location.hash='';location.reload();}">รีเซ็ตข้อมูลทดลอง</button>
    </div>
  </details>
  <script>if(window.innerWidth<760)document.getElementById('demo-banner').removeAttribute('open');</script>`;

let html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
html = html
  .replace(/(href|src)="\/(?!\/)/g, '$1="./')
  .replace('<title>', '<title>[Demo] ')
  .replace('<body>', `<body>${BANNER}`);
fs.writeFileSync(path.join(OUT, 'index.html'), html);

// ---------- ตรวจว่าไม่มี path แบบ absolute หลงเหลือ ----------
const leftovers = walk(OUT)
  .filter((f) => /\.(js|html)$/.test(f) && !f.includes('vendor'))
  .filter((f) => /(from\s+['"]\/(?!\/))|((src|href)=["']\/(?!\/))/.test(fs.readFileSync(f, 'utf8')));
if (leftovers.length) {
  console.error('[build-pages-demo] ยังมี path แบบ absolute:', leftovers);
  process.exit(1);
}
console.log(`[build-pages-demo] สร้างเวอร์ชันทดลองแล้วที่ ${path.relative(ROOT, OUT)}/`);
