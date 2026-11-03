# =============================================================
#  scripts/backup.ps1 — สำรองฐานข้อมูล + ไฟล์แนบ (สำหรับ Windows Server + Docker Desktop)
#  ตั้ง Task Scheduler ให้รันทุกคืน:
#    powershell -ExecutionPolicy Bypass -File C:\sugar-complaint-app\scripts\backup.ps1
# =============================================================
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

# ---------- อ่านค่าจาก .env ----------
$envVars = @{}
Get-Content .env | Where-Object { $_ -match '^\s*([A-Z_]+)\s*=\s*(.*)$' } | ForEach-Object {
  $envVars[$Matches[1]] = $Matches[2].Trim('"')
}

$keepDays = 30
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = 'backups'
New-Item -ItemType Directory -Force $out | Out-Null

# ---------- 1) ฐานข้อมูล ----------
docker compose exec -T db mariadb-dump -u root "-p$($envVars['DB_ROOT_PASSWORD'])" --single-transaction --routines $envVars['DB_NAME'] |
  Out-File -Encoding utf8 "$out\db-$stamp.sql"

# ---------- 2) ไฟล์แนบ ----------
docker compose cp app:/app/storage/uploads "$out\uploads-$stamp"

# ---------- 3) ลบไฟล์เก่า ----------
Get-ChildItem $out | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$keepDays) } | Remove-Item -Recurse -Force

Write-Output "[backup] เสร็จ $stamp"
