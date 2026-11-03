# Agent 1 — Project Manager : แผนโครงการ

ระบบข้อร้องเรียนสินค้า (น้ำตาล) — บริษัท น้ำตาลสุรินทร์ จำกัด (SRS / KI Group)
อ้างอิง: `../design_handoff_sugar_complaint/README.md` (design handoff, high-fidelity)

## 1. เป้าหมาย
เว็บแอปภายในให้ **ฝ่ายขาย** แจ้งข้อร้องเรียนคุณภาพสินค้า → **QA โรงงาน** ตรวจสอบ → **ผู้จัดการ** ทบทวน → **QMR** อนุมัติ → ส่งผลกลับฝ่ายขาย
พร้อมอีเมลแจ้งเตือนอัตโนมัติทุกขั้น และ audit trail (timeline) ที่ผูกกับบัญชีผู้ใช้จริง (รองรับระบบคุณภาพ ISO)

## 2. การตัดสินใจที่ผู้ใช้ยืนยันแล้ว
| หัวข้อ | การตัดสินใจ |
|---|---|
| Stack | Node.js (Express) + MariaDB/MySQL, หน้าเว็บ Vanilla JS (ES Modules) + Tailwind CSS |
| ฐานข้อมูล | รองรับทั้ง server ภายในบริษัท (ค่าเริ่มต้น) และ Cloud MySQL — สลับด้วยไฟล์ `.env` |
| การทำงานแบบ Agent | ทำทีละบทบาทตามลำดับ (PM → BE → FE → QA → DevOps) |
| ขอบเขต | ครบตาม handoff |

## 3. ขอบเขตงาน (Scope)
- Login ด้วย username/password ของระบบเอง (bcrypt), session cookie, บังคับเปลี่ยนรหัสครั้งแรก
- 5 บทบาท: sales / qa / mgr / qmr / admin ตามตารางสิทธิ์ใน handoff
- Workflow: `new → ack → inv → rev → apr → done` และ `cx` (ยกเลิก)
- แนบไฟล์ (รูป / PDF) เก็บบน disk ของ server
- อีเมลอัตโนมัติผ่าน SMTP (nodemailer)
- Dashboard: การ์ดสถิติ 6 ใบ, กราฟตามช่วงเวลา (Chart.js), งานของฉัน, ประเภทปัญหา
- รายการทั้งหมด: ค้นหา, filter chip, ส่งออก Excel (.xlsx) / CSV
- ตั้งค่า: อีเมลผู้รับแต่ละขั้น, จัดการผู้ใช้/สิทธิ์

**นอกขอบเขตรอบนี้** (เสนอทำรอบถัดไป — ต้องสอบถามผู้ใช้ก่อน)
- Layout แบบ `topbar` (ทำเฉพาะ `sidebar` + mobile bottom nav)
- นับกำหนดตอบเป็นวันทำการ / วันหยุดบริษัท
- เลือกผู้จัดการหลายตำแหน่งในเรื่องเดียว
- แจ้งเตือนผ่าน LINE / Microsoft Teams
- Single Sign-On (Active Directory)

## 4. การแบ่งงานตาม Agent
| Agent | ผลงาน (Deliverables) | ตำแหน่งไฟล์ |
|---|---|---|
| 1 PM | แผนโครงการ, ความเสี่ยง, เกณฑ์ตรวจรับ | `docs/01-PM-project-plan.md` |
| 2 Front-End | SPA, layout, ทุกหน้าจอ, Tailwind theme | `public/`, `tailwind.config.js` |
| 3 Back-End | REST API, workflow, DB schema, อีเมล, ไฟล์แนบ, export | `src/`, `shared/`, `db/` |
| 4 QA | Test plan, unit test (workflow/สิทธิ์), checklist ทดสอบมือ | `docs/04-QA-test-plan.md`, `tests/` |
| 5 DevOps | Docker, compose (on-prem/cloud), backup, คู่มือติดตั้ง | `Dockerfile`, `docker-compose*.yml`, `scripts/`, `docs/05-DEVOPS-deploy.md` |

> หมายเหตุ: Back-End ทำก่อน Front-End เพราะ FE ต้องเรียก API และใช้ค่าคงที่ร่วม (`shared/`)

## 5. Milestones
| # | งาน | เกณฑ์เสร็จ |
|---|---|---|
| M1 | Schema + API + workflow | unit test ผ่าน, API ตอบได้ครบ |
| M2 | หน้าเว็บครบ 7 หน้าจอ | ทดสอบ flow ครบทุกบทบาทได้บนเครื่อง dev |
| M3 | ติดตั้งบน server ทดสอบ | `docker compose up` แล้วใช้งานได้, อีเมลส่งจริง |
| M4 | UAT กับผู้ใช้จริง (ฝ่ายขาย/QA/QMR) | ผ่าน checklist ใน `docs/04-QA-test-plan.md` |
| M5 | Go-live + เชื่อมลิงก์จากเว็บบริษัท | ลิงก์จาก `192.168.20.254/surinsugar/index.php` ใช้งานได้ |

## 6. ความเสี่ยง
| ความเสี่ยง | ผลกระทบ | การรับมือ |
|---|---|---|
| ไม่มีข้อมูล SMTP จริง | อีเมลไม่ออก | ระบบทำงานต่อได้ — ถ้าไม่ตั้ง `SMTP_HOST` จะพิมพ์อีเมลลง log แทน |
| โดเมนอีเมลเป็นค่าสมมติ | ส่งผิดคน | แก้ใน seed / หน้าตั้งค่าก่อน go-live |
| server ไม่มีอินเทอร์เน็ต | font Google โหลดไม่ได้ | fallback เป็น system font, Chart.js/Tailwind ถูก build ไว้ในเครื่องแล้ว |
| ดิสก์ไฟล์แนบเต็ม | อัปโหลดไม่ได้ | จำกัดขนาดไฟล์ 10 MB, backup + เฝ้าดูพื้นที่ (ดูคู่มือ DevOps) |
| รหัสผ่านทดลอง `1234` | ความปลอดภัย | บังคับเปลี่ยนรหัสครั้งแรก, ปิด `SEED_DEMO` ใน production |

## 7. คำถามค้างที่ต้องยืนยันกับผู้ใช้ (ก่อน go-live)
1. ข้อมูล SMTP ของบริษัท (host, port, บัญชีผู้ส่ง)
2. รายชื่อผู้ใช้จริง + อีเมลจริง (แทนข้อมูลทดลอง)
3. Server ที่จะติดตั้ง: IP / port / ติดตั้ง Docker ได้หรือไม่
4. ต้องการ topbar layout / วันทำการ / LINE แจ้งเตือน หรือไม่
