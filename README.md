# ระบบข้อร้องเรียนสินค้า (น้ำตาล) — บริษัท น้ำตาลสุรินทร์ จำกัด

เว็บแอปภายใน: ฝ่ายขายแจ้งข้อร้องเรียน → QA ตรวจสอบ → ผู้จัดการทบทวน → QMR อนุมัติ → ส่งผลกลับฝ่ายขาย พร้อมอีเมลแจ้งเตือนอัตโนมัติ

## เริ่มใช้งานเร็ว (ทดลอง)
```bash
cp .env.example .env          # ตั้ง DB_PASSWORD, DB_ROOT_PASSWORD, SESSION_SECRET และ SEED_DEMO=true
docker compose up -d --build
```
เปิด http://localhost:3000 — บัญชีทดลอง `sales`, `sales2`, `qa`, `mgr`, `mgr2`, `mgr3`, `qmr`, `admin` (รหัส `1234`)

## เทคโนโลยี
Node.js 22 (Express) · MariaDB 11 / MySQL 8 (on-prem หรือ cloud) · Vanilla JS (ES Modules) · Tailwind CSS 3 · Chart.js 4 · Docker

## โครงสร้างโปรเจกต์
```
sugar-complaint-app/
├─ shared/              กฎธุรกิจ + ค่าคงที่ ใช้ร่วม Front-End / Back-End
│  ├─ constants.js      สถานะ, สินค้า, ประเภทปัญหา, หน่วย, สี
│  └─ workflow.js       สิทธิ์, การเปลี่ยนสถานะ, กำหนดตอบ, ผู้รับอีเมล
├─ src/                 Back-End
│  ├─ config/env.js     อ่าน .env
│  ├─ db/               pool, migrate, seed
│  ├─ repositories/     SQL ล้วน (ไม่มีกฎธุรกิจ)
│  ├─ services/         กฎธุรกิจ: complaint, user, mail, export, file-storage
│  ├─ middleware/       auth, CSRF, error handler
│  ├─ routes/           REST API
│  ├─ app.js            ประกอบ Express
│  └─ server.js         จุดเริ่มโปรแกรม
├─ public/              Front-End
│  ├─ js/main.js        router
│  ├─ js/api.js         เรียก API (ที่เดียว)
│  ├─ js/ui/            layout, components, toast
│  └─ js/views/         หน้าจอแต่ละหน้า
├─ db/schema.sql        โครงสร้างฐานข้อมูล
├─ tests/               unit test + e2e smoke test
├─ scripts/             backup
└─ docs/                เอกสารของแต่ละ Agent
```

## เอกสาร
| Agent | เอกสาร |
|---|---|
| 1 Project Manager | [docs/01-PM-project-plan.md](docs/01-PM-project-plan.md) |
| 2 Front-End / 3 Back-End | README นี้ + comment ในโค้ด + API ด้านล่าง |
| 4 QA | [docs/04-QA-test-plan.md](docs/04-QA-test-plan.md) |
| 5 DevOps | [docs/05-DEVOPS-deploy.md](docs/05-DEVOPS-deploy.md) |

## API โดยสรุป
ทุก request ที่แก้ข้อมูลต้องมี header `X-Requested-With: fetch`
| Method | Path | หน้าที่ |
|---|---|---|
| POST | `/api/auth/login` · `/logout` · `/change-password` | เข้าสู่ระบบ / ออก / เปลี่ยนรหัส |
| GET | `/api/auth/me` | ผู้ใช้ปัจจุบัน |
| GET / POST | `/api/complaints` | รายการ / แจ้งเรื่องใหม่ (multipart) |
| GET | `/api/complaints/:id` | รายละเอียด + timeline + `actions` ที่ทำได้ |
| POST | `/api/complaints/:id/actions/:name` | `ack` `saveQa` `submitReview` `review` `sendBack` `approve` `reject` `cancel` `note` |
| POST | `/api/complaints/:id/files` | QA แนบหลักฐาน |
| GET / DELETE | `/api/attachments/:id` | เปิด / ลบไฟล์แนบ |
| GET | `/api/complaints/export?format=xlsx\|csv&filter=&q=` | ส่งออกไฟล์ |
| GET / PUT | `/api/settings/mail` | อีเมลแจ้งเตือน |
| GET / POST / PATCH | `/api/users` · `/api/users/:id` · `/:id/reset-password` | จัดการผู้ใช้ |

## แก้ไขบ่อย — แก้ที่ไหน
| ต้องการ | ไฟล์ |
|---|---|
| เพิ่มชนิดสินค้า / ประเภทปัญหา / หน่วย / ตำแหน่งผู้จัดการ | `shared/constants.js` |
| เปลี่ยน workflow / สิทธิ์ / จำนวนวันกำหนดตอบ | `shared/workflow.js` (แล้วรัน `npm test`) |
| ข้อความ log / toast ของแต่ละ action | `src/services/complaint-service.js` (`HANDLERS`) |
| เนื้อหาอีเมล | `src/services/mail-service.js` |
| ช่องในฟอร์มแจ้งเรื่อง | `public/js/views/new-complaint.js` (`SECTIONS`) + `db/schema.sql` |
| สีแบรนด์ / ฟอนต์ | `tailwind.config.js` แล้ว `npm run build:css` |

## คำสั่ง
```bash
npm run dev          # รันแบบ auto-reload
npm run build:css    # build Tailwind
npm test             # unit test
node tests/e2e/smoke-test.mjs   # e2e (ต้องเปิดระบบโหมดทดลองก่อน)
```
