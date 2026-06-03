// ============================================================
// charts.js — Chart.js chart creation & click/drill handlers
// ============================================================
const API = 'http://localhost:3001';

const COLORS = {
  indigo:  '#6366f1', violet: '#8b5cf6', cyan:   '#06b6d4',
  emerald: '#10b981', amber:  '#f59e0b', rose:   '#f43f5e',
  sky:     '#38bdf8', lime:   '#84cc16',
};

const DEPT_COLORS   = [COLORS.indigo, COLORS.violet, COLORS.cyan, COLORS.emerald, COLORS.amber];
const STATUS_COLORS = {
  'In Progress': COLORS.indigo,
  'Completed':   COLORS.emerald,
  'Planning':    COLORS.amber,
  'On Hold':     COLORS.rose,
};

// Active chart instances
const _charts = {};

// ── Chart.js global defaults ─────────────────────────────────
Chart.defaults.color           = '#94a3b8';
Chart.defaults.font.family     = 'Inter, sans-serif';
Chart.defaults.font.size       = 11;
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.legend.labels.padding  = 14;

function baseBarOpts(onClickFn) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (evt, els) => { if (els.length) onClickFn(els[0].index); },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(14,21,37,.95)',
        borderColor: 'rgba(255,255,255,.1)',
        borderWidth: 1,
        padding: 10,
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,.04)' },
        ticks: { color: '#94a3b8' },
      },
      y: {
        grid: { color: 'rgba(255,255,255,.04)' },
        ticks: { color: '#94a3b8' },
        beginAtZero: true,
      },
    },
  };
}

function baseDonutOpts(onClickFn) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    onClick: (evt, els) => { if (els.length) onClickFn(els[0].index); },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#94a3b8', padding: 16, usePointStyle: true, pointStyleWidth: 10 },
      },
      tooltip: {
        backgroundColor: 'rgba(14,21,37,.95)',
        borderColor: 'rgba(255,255,255,.1)',
        borderWidth: 1,
        padding: 10,
        titleColor: '#f1f5f9',
        bodyColor: '#94a3b8',
      },
    },
  };
}

// ── Destroy existing chart ────────────────────────────────────
function destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

// ── Employees by Department ───────────────────────────────────
async function loadDeptEmpChart(deptData) {
  destroyChart('dept-emp');
  const data = deptData || await fetchJSON('/api/chart/dept-employees');
  if (!data) return;

  const ctx  = document.getElementById('chart-dept-emp').getContext('2d');
  const opts = baseBarOpts((idx) => {
    const dept = data[idx];
    drillDepartment(dept.DepartmentID, dept.Department);
  });

  opts.plugins.tooltip.callbacks = {
    label: (ctx) => ` ${ctx.parsed.y} employees`,
  };

  _charts['dept-emp'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels:   data.map(d => d.Department),
      datasets: [{
        label: 'Employees',
        data:  data.map(d => d.EmployeeCount),
        backgroundColor: data.map((_, i) => DEPT_COLORS[i % DEPT_COLORS.length] + 'cc'),
        borderColor:     data.map((_, i) => DEPT_COLORS[i % DEPT_COLORS.length]),
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: data.map((_, i) => DEPT_COLORS[i % DEPT_COLORS.length]),
      }],
    },
    options: opts,
  });
  window._deptEmpData = data;
}

// ── Avg Salary by Department ──────────────────────────────────
async function loadDeptSalaryChart(salData) {
  destroyChart('dept-salary');
  const data = salData || await fetchJSON('/api/chart/dept-salary');
  if (!data) return;

  const ctx  = document.getElementById('chart-dept-salary').getContext('2d');
  const opts = baseBarOpts((idx) => {
    const dept = data[idx];
    drillDepartment(dept.DepartmentID, dept.Department, 'salary');
  });

  opts.plugins.tooltip.callbacks = {
    label: (ctx) => ` Avg: $${ctx.parsed.y.toLocaleString()}`,
    afterLabel: (ctx) => {
      const d = data[ctx.dataIndex];
      return [`  Min: $${d.MinSalary.toLocaleString()}`, `  Max: $${d.MaxSalary.toLocaleString()}`];
    },
  };

  _charts['dept-salary'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels:   data.map(d => d.Department),
      datasets: [{
        label: 'Avg Salary',
        data:  data.map(d => d.AvgSalary),
        backgroundColor: COLORS.cyan + 'aa',
        borderColor:     COLORS.cyan,
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: COLORS.cyan,
      }],
    },
    options: {
      ...opts,
      scales: {
        ...opts.scales,
        y: { ...opts.scales.y, ticks: { ...opts.scales.y.ticks, callback: v => '$' + (v/1000).toFixed(0) + 'k' } },
      },
    },
  });
}

// ── Project Status Donut ──────────────────────────────────────
async function loadProjectStatusChart(projData) {
  destroyChart('proj-status');
  const data = projData || await fetchJSON('/api/chart/project-status');
  if (!data) return;

  const ctx  = document.getElementById('chart-proj-status').getContext('2d');
  const opts = baseDonutOpts((idx) => {
    const item = data[idx];
    drillProjectStatus(item.Status);
  });

  opts.plugins.tooltip.callbacks = {
    label: (ctx) => {
      const d = data[ctx.dataIndex];
      return ` ${ctx.label}: ${d.ProjectCount} projects ($${(d.TotalBudget/1000).toFixed(0)}k budget)`;
    },
  };

  _charts['proj-status'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels:   data.map(d => d.Status),
      datasets: [{
        data:            data.map(d => d.ProjectCount),
        backgroundColor: data.map(d => (STATUS_COLORS[d.Status] || COLORS.sky) + 'cc'),
        borderColor:     data.map(d => STATUS_COLORS[d.Status] || COLORS.sky),
        borderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: opts,
  });
}

// ── Manager Span Bar ─────────────────────────────────────────
async function loadManagerSpanChart(spanData) {
  destroyChart('manager-span');
  const data = spanData || await fetchJSON('/api/chart/manager-span');
  if (!data) return;

  const ctx  = document.getElementById('chart-manager-span').getContext('2d');
  const opts = baseBarOpts((idx) => {
    const mgr = data[idx];
    drillManager(mgr.ManagerID, mgr.ManagerName);
  });

  opts.plugins.tooltip.callbacks = {
    label: (ctx) => ` ${ctx.parsed.y} direct reports`,
    afterLabel: (ctx) => `  Title: ${data[ctx.dataIndex].JobTitle}`,
  };
  opts.scales.x.ticks = { color: '#94a3b8', maxRotation: 35, minRotation: 20 };

  const shortNames = data.map(d => d.ManagerName.split(' ')[0]);
  _charts['manager-span'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: shortNames,
      datasets: [{
        label: 'Direct Reports',
        data:  data.map(d => d.DirectReports),
        backgroundColor: COLORS.violet + 'aa',
        borderColor:     COLORS.violet,
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: COLORS.violet,
      }],
    },
    options: opts,
  });
  window._managerSpanData = data;
}

// ── Project Budget Bar ────────────────────────────────────────
async function loadBudgetChart(budgetData) {
  destroyChart('budget');
  const data = budgetData || await fetchJSON('/api/chart/project-budget');
  if (!data) return;

  const ctx  = document.getElementById('chart-budget').getContext('2d');
  const opts = baseBarOpts((idx) => {
    const proj = data[idx];
    drillProject(proj.ProjectID, proj.Name);
  });

  opts.plugins.tooltip.callbacks = {
    label: (ctx) => ` Budget: $${(ctx.parsed.y/1000).toFixed(0)}k`,
    afterLabel: (ctx) => ` Status: ${data[ctx.dataIndex].Status}`,
  };
  opts.scales.y.ticks = { ...opts.scales.y.ticks, callback: v => '$' + (v/1000).toFixed(0) + 'k' };
  opts.scales.x.ticks = { color: '#94a3b8', maxRotation: 40, minRotation: 25 };

  const shortNames = data.map(d => d.Name.length > 18 ? d.Name.substring(0,17)+'…' : d.Name);
  _charts['budget'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: shortNames,
      datasets: [{
        label: 'Budget',
        data:  data.map(d => d.Budget),
        backgroundColor: data.map(d => (STATUS_COLORS[d.Status] || COLORS.amber) + 'aa'),
        borderColor:     data.map(d => STATUS_COLORS[d.Status] || COLORS.amber),
        borderWidth: 2,
        borderRadius: 6,
      }],
    },
    options: opts,
  });
  window._budgetData = data;
}

// ── Job Titles Pie ────────────────────────────────────────────
async function loadJobTitlesChart(titleData) {
  destroyChart('titles');
  const data = titleData || await fetchJSON('/api/chart/job-titles');
  if (!data) return;

  const top8 = data.slice(0, 8);
  const ctx  = document.getElementById('chart-titles').getContext('2d');
  const opts = baseDonutOpts((idx) => {
    const item = top8[idx];
    drillJobTitle(item.JobTitle);
  });

  opts.cutout = '50%';
  opts.plugins.tooltip.callbacks = {
    label: (ctx) => ` ${ctx.label}: ${ctx.parsed} people`,
    afterLabel: (ctx) => `  Avg Salary: $${top8[ctx.dataIndex].AvgSalary.toLocaleString()}`,
  };

  const allColors = Object.values(COLORS);
  _charts['titles'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels:   top8.map(d => d.JobTitle),
      datasets: [{
        data:            top8.map(d => d.Count),
        backgroundColor: top8.map((_, i) => allColors[i % allColors.length] + 'bb'),
        borderColor:     top8.map((_, i) => allColors[i % allColors.length]),
        borderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: opts,
  });
  window._jobTitleData = data;
}

// ── Load All Charts ───────────────────────────────────────────
async function loadAllCharts() {
  await Promise.all([
    loadDeptEmpChart(),
    loadDeptSalaryChart(),
    loadProjectStatusChart(),
    loadManagerSpanChart(),
    loadBudgetChart(),
    loadJobTitlesChart(),
  ]);
}

// ── Fetch helper ──────────────────────────────────────────────
async function fetchJSON(path) {
  try {
    const r = await fetch(API + path);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) {
    console.error('Fetch error:', path, e);
    return null;
  }
}
