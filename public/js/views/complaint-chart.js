/**
 * ============================================================
 *  views/complaint-chart.js — กราฟ "ข้อร้องเรียนตามช่วงเวลา" (Dashboard)
 *   แกนนอน = เวลา, แกนตั้ง = จำนวนเรื่อง (ไม่นับที่ยกเลิก)
 *   ชนิด      : กราฟแท่ง / กราฟเส้น
 *   ความละเอียด: รายวัน DD/MM/YYYY (ค.ศ.) / รายเดือน (ชื่ออังกฤษ) / รายปี (พ.ศ.)
 *   ช่วงเวลา  : ภาพรวม / เลือกปี / กำหนดเอง (DD/MM/YYYY)
 * ============================================================
 */
import { html, $, on, options } from '../utils/dom.js';
import { fmtDmy, parseDmy } from '../utils/format.js';
import { DAY_MS } from '/shared/workflow.js';
import { state } from '../state.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MAX_DAILY_DAYS = 366;
const BRAND = '#D7262E';

const dayStart = (ms) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/* ------------------------------------------------------------
 * 1) คำนวณข้อมูลกราฟ (pure function — ทดสอบง่าย)
 * ---------------------------------------------------------- */
export function buildBuckets(items, opt, today = new Date()) {
  // ---------- ช่วงวันที่ ----------
  let start;
  let end;
  if (opt.range === 'all') {
    start = items.length ? dayStart(Math.min(...items.map((i) => i.createdAt))) : dayStart(today);
    end = dayStart(today);
  } else if (opt.range === 'year') {
    start = new Date(opt.year, 0, 1);
    end = new Date(opt.year, 11, 31);
  } else {
    start = parseDmy(opt.start);
    end = parseDmy(opt.end);
  }

  // ---------- ตรวจความถูกต้อง ----------
  let error = '';
  if (!start || !end) error = 'กรุณากรอกวันที่ในรูปแบบ DD/MM/YYYY (ค.ศ.) เช่น 14/01/2026';
  else if (start > end) error = 'Start date ต้องไม่เกิน End date';
  else if (opt.gran === 'day' && (end - start) / DAY_MS > MAX_DAILY_DAYS) {
    error = 'รายวันเลือกช่วงได้ไม่เกิน 366 วัน — เลือกแสดงรายเดือนหรือรายปีแทน';
  }
  if (error) return { error, buckets: [], start, end };

  // ---------- นับเรื่อง (ไม่รวม cx) ----------
  const t0 = start.getTime();
  const t1 = addDays(end, 1).getTime();
  const active = items.filter((i) => i.status !== 'cx' && i.createdAt >= t0 && i.createdAt < t1);
  const buckets = [];

  if (opt.gran === 'day') {
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const a = d.getTime();
      const b = addDays(d, 1).getTime();
      buckets.push({ label: fmtDmy(d), n: active.filter((i) => i.createdAt >= a && i.createdAt < b).length });
    }
  } else if (opt.gran === 'month') {
    const multiYear = start.getFullYear() !== end.getFullYear();
    for (let y = start.getFullYear(), m = start.getMonth(); y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth()); ) {
      const yy = y;
      const mm = m;
      buckets.push({
        label: MONTHS[mm] + (multiYear ? ` ${yy}` : ''),
        n: active.filter((i) => {
          const d = new Date(i.createdAt);
          return d.getFullYear() === yy && d.getMonth() === mm;
        }).length,
      });
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
  } else {
    for (let y = start.getFullYear(); y <= end.getFullYear(); y += 1) {
      buckets.push({ label: String(y + 543), n: active.filter((i) => new Date(i.createdAt).getFullYear() === y).length });
    }
  }
  return { error: '', buckets, start, end };
}

/** สเกลแกนตั้ง: step=1 ถ้า max<=5 ไม่งั้น ceil(max/5) */
export function yScale(max) {
  const step = max <= 5 ? 1 : Math.ceil(max / 5);
  return { step, top: max === 0 ? 5 : step * Math.ceil(max / step) };
}

/* ------------------------------------------------------------
 * 2) Plugin วาดตัวเลขเหนือแท่ง/จุด (11px / 600)
 * ---------------------------------------------------------- */
const valueLabels = {
  id: 'valueLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = '600 11px "IBM Plex Sans Thai", sans-serif';
    ctx.fillStyle = '#3B3331';
    ctx.textAlign = 'center';
    chart.getDatasetMeta(0).data.forEach((el, i) => {
      const v = chart.data.datasets[0].data[i];
      if (v) ctx.fillText(String(v), el.x, el.y - 8);
    });
    ctx.restore();
  },
};

/* ------------------------------------------------------------
 * 3) Render แผงกราฟ
 * ---------------------------------------------------------- */
let chartInstance = null;

const seg = (key, list) => html`
  <div class="seg" role="group">
    ${list.map(([value, label]) => html`<button type="button" data-seg="${key}" data-value="${value}" aria-pressed="${state.chart[key] === value}">${label}</button>`)}
  </div>`;

function yearOptions() {
  const now = new Date().getFullYear();
  const first = state.items.length ? new Date(Math.min(...state.items.map((i) => i.createdAt))).getFullYear() : now;
  const years = [];
  for (let y = now; y >= first; y -= 1) years.push([String(y), String(y + 543)]);
  return years;
}

export function renderChartPanel(root) {
  const opt = state.chart;
  const { error, buckets, start, end } = buildBuckets(state.items, opt);
  const total = buckets.reduce((a, b) => a + b.n, 0);
  const startBad = opt.range === 'custom' && !parseDmy(opt.start);
  const endBad = opt.range === 'custom' && !parseDmy(opt.end);

  root.innerHTML = html`
    <div class="card-head flex-wrap">
      <div>
        <div>ข้อร้องเรียนตามช่วงเวลา</div>
        <div class="meta font-normal">${error ? '' : `รวม ${total} เรื่อง · ${fmtDmy(start)} – ${fmtDmy(end)} · ไม่นับเรื่องที่ยกเลิก`}</div>
      </div>
      <div class="flex flex-wrap gap-2">
        ${seg('type', [['bar', 'กราฟแท่ง'], ['line', 'กราฟเส้น']])}
        ${seg('gran', [['day', 'รายวัน'], ['month', 'รายเดือน'], ['year', 'รายปี']])}
      </div>
    </div>
    <div class="card-body flex flex-col gap-3">
      <div class="flex flex-wrap items-end gap-2">
        ${seg('range', [['all', 'ภาพรวม'], ['year', 'เลือกปี'], ['custom', 'กำหนดเอง']])}
        ${opt.range === 'year' ? html`<select data-chart-input="year" class="input w-auto py-1.5">${options(yearOptions(), String(opt.year))}</select>` : ''}
        ${opt.range === 'custom' ? html`
          <label class="field"><span class="meta">Start date</span>
            <input data-chart-input="start" value="${opt.start}" placeholder="DD/MM/YYYY" class="input py-1.5 w-[130px] ${startBad ? 'input-err' : ''}"></label>
          <label class="field"><span class="meta">End date</span>
            <input data-chart-input="end" value="${opt.end}" placeholder="DD/MM/YYYY" class="input py-1.5 w-[130px] ${endBad ? 'input-err' : ''}"></label>` : ''}
      </div>
      ${error
        ? html`<div class="text-brand-dark bg-brand-err rounded-ctl px-3 py-2 text-[13px]">${error}</div>`
        : html`<div class="overflow-x-auto"><div style="height:260px;min-width:${buckets.length * (opt.gran === 'day' ? 34 : 52)}px"><canvas id="complaint-chart"></canvas></div></div>`}
    </div>`;

  // ผูก event ครั้งเดียวต่อ element (render ซ้ำได้โดยไม่ซ้อน listener)
  if (!root.dataset.bound) {
    bindChartEvents(root);
    root.dataset.bound = '1';
  }
  if (!error) drawChart($('#complaint-chart', root), buckets, opt);
}

function drawChart(canvas, buckets, opt) {
  if (chartInstance) chartInstance.destroy();
  if (!window.Chart) return; // Chart.js โหลดไม่สำเร็จ
  const max = Math.max(0, ...buckets.map((b) => b.n));
  const { step, top } = yScale(max);
  const isLine = opt.type === 'line';
  const dense = buckets.length > (opt.gran === 'day' ? 6 : 14);

  chartInstance = new window.Chart(canvas, {
    type: isLine ? 'line' : 'bar',
    data: {
      labels: buckets.map((b) => b.label),
      datasets: [{
        data: buckets.map((b) => b.n),
        backgroundColor: isLine ? '#fff' : BRAND,
        borderColor: BRAND,
        borderWidth: 2,
        borderRadius: { topLeft: 4, topRight: 4 },
        barPercentage: 0.62,
        categoryPercentage: 1,
        maxBarThickness: 44,
        pointRadius: 5,
        pointBorderWidth: 2,
        tension: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { top: 18 } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.parsed.y} เรื่อง` } } },
      scales: {
        x: {
          grid: { display: false },
          border: { color: '#CFC6C3' },
          ticks: { autoSkip: false, maxRotation: dense ? 45 : 0, minRotation: dense ? 45 : 0, color: '#6E6562', font: { size: 11 } },
          title: { display: true, text: { day: 'วันที่ (ค.ศ.)', month: 'เดือน', year: 'ปี (พ.ศ.)' }[opt.gran], color: '#6E6562' },
        },
        y: {
          min: 0,
          max: top,
          grid: { color: '#F1ECEA' },
          border: { display: false },
          ticks: { stepSize: step, precision: 0, color: '#6E6562', font: { size: 11 } },
          title: { display: true, text: 'จำนวนเรื่อง', color: '#6E6562' },
        },
      },
    },
    plugins: [valueLabels],
  });
}

function bindChartEvents(root) {
  // ปุ่ม segmented
  on(root, 'click', '[data-seg]', (e, el) => {
    const key = el.dataset.seg;
    state.chart[key] = el.dataset.value;
    // "ภาพรวม" + รายวัน -> สลับเป็นรายเดือนอัตโนมัติ
    if (key === 'range' && el.dataset.value === 'all' && state.chart.gran === 'day') state.chart.gran = 'month';
    renderChartPanel(root);
  });
  // ปี / วันที่ (กรอกเสร็จแล้วกด Enter หรือออกจากช่อง)
  on(root, 'change', '[data-chart-input]', (e, el) => {
    const key = el.dataset.chartInput;
    state.chart[key] = key === 'year' ? Number(el.value) : el.value;
    renderChartPanel(root);
  });
}
