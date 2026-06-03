// ============================================================
// app.js — Main controller: connection, KPIs, nav, views, toast
// ============================================================

window._dbConnected = false;
window._currentView = 'overview';
window._authType    = 'windows';

// Local data caches (reset on disconnect)
let _allEmployees = [];
let _allProjects  = [];
let _allDepts     = [];
let _empFiltersWired  = false;
let _projTabsWired    = false;

// ── On DOM Ready ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  checkServerStatus();
  initNav();
});

// ── Auth Type Toggle ──────────────────────────────────────────
function setAuthType(type) {
  window._authType = type;
  document.getElementById('auth-btn-windows').classList.toggle('active', type === 'windows');
  document.getElementById('auth-btn-sql').classList.toggle('active', type === 'sql');
  document.getElementById('windows-fields').style.display = type === 'windows' ? '' : 'none';
  document.getElementById('sql-fields').style.display     = type === 'sql'     ? '' : 'none';
  document.getElementById('auth-sub').textContent = type === 'windows'
    ? 'Windows Authentication — enter your Windows login credentials'
    : 'SQL Server Authentication — use your SQL Server login';
}

// ── Check if server is already connected ──────────────────────
async function checkServerStatus() {
  try {
    const r    = await fetch(`${API}/api/status`);
    const data = await r.json();
    if (data.connected) {
      setConnected(true, data.server, data.database);
      await initDashboard();
    }
  } catch (e) {
    document.getElementById('conn-text').textContent = 'Start Server';
    showToast('Start the API server: cd server && node index.js', 'error');
  }
}

// ── Modal Open / Close ────────────────────────────────────────
function openConnModal() {
  document.getElementById('modal-overlay').classList.add('visible');
  document.getElementById('db-server').focus();
}
function closeConnModal() {
  document.getElementById('modal-overlay').classList.remove('visible');
}

// Close modal on background click
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeConnModal();
});

// Enter key submits connection
['db-server','db-name','db-domain','db-user','db-pass','db-sql-user','db-sql-pass'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') connectDB(); });
});

// ── Connect to SQL Server ─────────────────────────────────────
async function connectDB() {
  const server   = document.getElementById('db-server').value.trim() || 'localhost';
  const database = document.getElementById('db-name').value.trim()   || 'CompanyDB';
  const authType = window._authType;
  const btn      = document.getElementById('connect-btn');

  let body;
  if (authType === 'sql') {
    const userName = document.getElementById('db-sql-user').value.trim();
    const password = document.getElementById('db-sql-pass').value;
    body = { server, database, authType: 'sql', userName, password };
  } else {
    const domain   = document.getElementById('db-domain').value.trim();
    const userName = document.getElementById('db-user').value.trim();
    const password = document.getElementById('db-pass').value;
    body = { server, database, authType: 'windows', domain, userName, password };
  }

  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span> Connecting…';

  try {
    const r = await fetch(`${API}/api/connect`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const data = await r.json();

    if (data.success) {
      setConnected(true, server, database);
      closeConnModal();
      showToast(`Connected to ${server}/${database}`, 'success');
      // Reset caches on new connection
      _allEmployees = []; _allProjects = []; _allDepts = [];
      _empFiltersWired = false; _projTabsWired = false;
      await initDashboard();
    } else {
      showToast('Connection failed: ' + data.message, 'error');
    }
  } catch (e) {
    showToast('Cannot reach API server. Run: cd server && node index.js', 'error');
  } finally {
    btn.disabled  = false;
    btn.innerHTML = 'Connect';
  }
}

// ── Update connection UI ──────────────────────────────────────
function setConnected(state, server) {
  window._dbConnected = state;
  document.getElementById('conn-dot').className    = state ? 'connected' : '';
  document.getElementById('conn-text').textContent = state ? `${server}` : 'Connect DB';
}

// ── Init Dashboard ────────────────────────────────────────────
async function initDashboard() {
  document.getElementById('disconnected-screen').style.display = 'none';
  await switchView('overview');
}

// ── View Switcher ─────────────────────────────────────────────
async function switchView(viewName) {
  window._currentView = viewName;

  // Hide all views
  document.querySelectorAll('.app-view').forEach(v => v.style.display = 'none');

  const el = document.getElementById('view-' + viewName);
  if (!el) return;
  el.style.display = '';

  if      (viewName === 'overview')    await loadOverviewView();
  else if (viewName === 'employees')   await loadEmployeesView();
  else if (viewName === 'departments') await loadDepartmentsView();
  else if (viewName === 'projects')    await loadProjectsView();
  else if (viewName === 'management')  await loadManagementView();
}

// ── Overview View ─────────────────────────────────────────────
async function loadOverviewView() {
  await Promise.all([loadKPIs(), loadAllCharts()]);
}

// ── Load KPI Cards ────────────────────────────────────────────
async function loadKPIs() {
  try {
    const data = await fetchJSON('/api/overview');
    if (!data) return;
    document.getElementById('kpi-employees').textContent = data.TotalEmployees;
    document.getElementById('kpi-depts').textContent     = data.TotalDepartments;
    document.getElementById('kpi-projects').textContent  = data.TotalProjects;
    document.getElementById('kpi-active').textContent    = data.ActiveProjects;
    document.getElementById('kpi-salary').textContent    = '$' + Number(data.AvgSalary).toLocaleString();
    document.getElementById('kpi-managers').textContent  = data.TotalManagers;
    document.getElementById('kpi-proj-sub').textContent  = `${data.ActiveProjects} in progress`;
  } catch (e) {
    console.error('KPI load error:', e);
  }
}

// ── Employees View ────────────────────────────────────────────
async function loadEmployeesView() {
  if (!_allEmployees.length) {
    document.getElementById('employees-table-wrap').innerHTML =
      '<div class="loading-state"><div class="spinner"></div> Loading employees…</div>';

    const data = await fetchJSON('/api/employees');
    if (!data) { showToast('Failed to load employees', 'error'); return; }
    _allEmployees = data;
  }

  if (!_empFiltersWired) {
    // Populate department dropdown
    const depts = [...new Set(_allEmployees.map(e => e.Department))].sort();
    const sel   = document.getElementById('emp-dept-filter');
    sel.innerHTML = '<option value="">All Departments</option>';
    depts.forEach(d => {
      const o = document.createElement('option');
      o.value = d; o.textContent = d; sel.appendChild(o);
    });
    sel.addEventListener('change', renderEmployeesTable);
    document.getElementById('emp-search').addEventListener('input', renderEmployeesTable);
    _empFiltersWired = true;
  }

  renderEmployeesTable();
}

function renderEmployeesTable() {
  const deptFilter   = document.getElementById('emp-dept-filter').value;
  const searchFilter = document.getElementById('emp-search').value.toLowerCase().trim();

  const filtered = _allEmployees.filter(e => {
    const matchDept   = !deptFilter   || e.Department === deptFilter;
    const matchSearch = !searchFilter ||
      (e.Name   || '').toLowerCase().includes(searchFilter) ||
      (e.JobTitle || '').toLowerCase().includes(searchFilter);
    return matchDept && matchSearch;
  });

  document.getElementById('emp-count-label').textContent =
    `${filtered.length} of ${_allEmployees.length} employees`;

  if (!filtered.length) {
    document.getElementById('employees-table-wrap').innerHTML = `
      <div style="text-align:center;padding:60px;color:var(--text3)">
        <div style="font-size:48px;margin-bottom:14px">🔍</div>
        <p style="font-size:14px">No employees match your filters. Try a different search.</p>
      </div>`;
    return;
  }

  const rows = filtered.map(e => `
    <tr onclick="drillEmployee(${e.EmployeeID},'${escHtml(e.Name)}')">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="drill-avatar" style="width:34px;height:34px;font-size:13px;min-width:34px">${initials(e.Name)}</div>
          <div>
            <div style="font-weight:600;font-size:13px">${escHtml(e.Name)}</div>
            <div style="color:var(--text2);font-size:11px">${escHtml(e.JobTitle)}</div>
          </div>
        </div>
      </td>
      <td style="color:var(--text2);font-size:12px">${escHtml(e.Department)}</td>
      <td class="salary-cell">${fmtSalary(e.Salary)}</td>
      <td style="color:var(--text2);font-size:12px">${escHtml(e.ManagerName || '—')}</td>
      <td style="color:var(--text3);font-size:11.5px">${e.HireDate ? e.HireDate.substring(0,10) : '—'}</td>
      <td><span class="status-pill ${e.Status === 'Active' ? 'completed' : 'onhold'}">${escHtml(e.Status)}</span></td>
    </tr>`).join('');

  document.getElementById('employees-table-wrap').innerHTML = `
    <table class="drill-table view-table">
      <thead><tr>
        <th>Employee</th><th>Department</th><th>Salary</th>
        <th>Manager</th><th>Hired</th><th>Status</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── Departments View ──────────────────────────────────────────
async function loadDepartmentsView() {
  if (!_allDepts.length) {
    document.getElementById('departments-grid').innerHTML =
      '<div class="loading-state"><div class="spinner"></div> Loading departments…</div>';

    const data = await fetchJSON('/api/departments');
    if (!data) { showToast('Failed to load departments', 'error'); return; }
    _allDepts = data;
  }

  document.getElementById('dept-count-label').textContent = `${_allDepts.length} departments`;

  const allColors = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b'];

  const cards = _allDepts.map((d, i) => {
    const color = allColors[i % allColors.length];
    return `
    <div class="dept-card" onclick="drillDepartment(${d.DepartmentID},'${escHtml(d.Name)}')">
      <div class="dept-card-top" style="background:${color}22;border-bottom:2px solid ${color}44">
        <div class="dept-card-icon" style="background:${color}33;color:${color}">🏢</div>
        <div class="dept-card-name" style="color:${color}">${escHtml(d.Name)}</div>
      </div>
      <div class="dept-card-body">
        <div class="dept-card-loc">📍 ${escHtml(d.Location || 'No location set')}</div>
        <div class="dept-card-stats">
          <div class="dept-stat">
            <div class="dept-stat-val">${d.EmployeeCount || 0}</div>
            <div class="dept-stat-lbl">Employees</div>
          </div>
          <div class="dept-stat">
            <div class="dept-stat-val">${d.AvgSalary ? '$' + Number(Math.round(d.AvgSalary)).toLocaleString() : '—'}</div>
            <div class="dept-stat-lbl">Avg Salary</div>
          </div>
          <div class="dept-stat">
            <div class="dept-stat-val">${d.Budget ? '$' + (d.Budget / 1000000).toFixed(1) + 'M' : '—'}</div>
            <div class="dept-stat-lbl">Budget</div>
          </div>
        </div>
      </div>
      <div class="dept-card-footer" style="color:${color}">View employees →</div>
    </div>`;
  }).join('');

  document.getElementById('departments-grid').innerHTML = cards;
}

// ── Projects View ─────────────────────────────────────────────
async function loadProjectsView() {
  if (!_allProjects.length) {
    document.getElementById('projects-table-wrap').innerHTML =
      '<div class="loading-state"><div class="spinner"></div> Loading projects…</div>';

    const data = await fetchJSON('/api/projects');
    if (!data) { showToast('Failed to load projects', 'error'); return; }
    _allProjects = data;
  }

  if (!_projTabsWired) {
    document.querySelectorAll('.status-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.status-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderProjectsTable(btn.dataset.status);
      });
    });
    _projTabsWired = true;
  }

  renderProjectsTable('');
}

function renderProjectsTable(statusFilter) {
  const filtered = statusFilter
    ? _allProjects.filter(p => p.Status === statusFilter)
    : _allProjects;

  document.getElementById('proj-count-label').textContent =
    `${filtered.length} ${statusFilter || 'total'} project${filtered.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    document.getElementById('projects-table-wrap').innerHTML = `
      <div style="text-align:center;padding:60px;color:var(--text3)">
        <div style="font-size:48px;margin-bottom:14px">📁</div>
        <p style="font-size:14px">No projects in this category.</p>
      </div>`;
    return;
  }

  const statusCls = { 'In Progress':'inprogress', 'Completed':'completed', 'Planning':'planning', 'On Hold':'onhold' };

  const rows = filtered.map(p => `
    <tr onclick="drillProject(${p.ProjectID},'${escHtml(p.Name)}')">
      <td>
        <div style="font-weight:600;font-size:13px">${escHtml(p.Name)}</div>
        <div style="color:var(--text2);font-size:11px">${escHtml(p.Department)}</div>
      </td>
      <td><span class="status-pill ${statusCls[p.Status] || ''}">${escHtml(p.Status)}</span></td>
      <td class="salary-cell">$${(p.Budget / 1000).toFixed(0)}k</td>
      <td style="color:var(--text3);font-size:11.5px">${p.StartDate || '—'} → ${p.EndDate || '—'}</td>
      <td style="color:var(--cyan)">${p.TeamSize} member${p.TeamSize !== 1 ? 's' : ''}</td>
    </tr>`).join('');

  document.getElementById('projects-table-wrap').innerHTML = `
    <table class="drill-table view-table">
      <thead><tr>
        <th>Project</th><th>Status</th><th>Budget</th><th>Timeline</th><th>Team Size</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── Management View ───────────────────────────────────────────
async function loadManagementView() {
  document.getElementById('management-grid').innerHTML =
    '<div class="loading-state"><div class="spinner"></div> Loading management data…</div>';

  const data = await fetchJSON('/api/management');
  if (!data) { showToast('Failed to load management data', 'error'); return; }

  document.getElementById('mgmt-count-label').textContent =
    `${data.length} manager${data.length !== 1 ? 's' : ''} in leadership`;

  if (!data.length) {
    document.getElementById('management-grid').innerHTML =
      '<div style="color:var(--text3);padding:20px">No management data found.</div>';
    return;
  }

  const levelColors = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#f43f5e'];

  const cards = data.map((m, i) => {
    const color = levelColors[i % levelColors.length];
    return `
    <div class="mgmt-card" onclick="drillManager(${m.ManagerID},'${escHtml(m.ManagerName)}')">
      <div class="mgmt-avatar" style="background:linear-gradient(135deg,${color},${levelColors[(i+1)%levelColors.length]})">${initials(m.ManagerName)}</div>
      <div class="mgmt-info">
        <div class="mgmt-name">${escHtml(m.ManagerName)}</div>
        <div class="mgmt-title">${escHtml(m.JobTitle)}</div>
        <div class="mgmt-dept">🏢 ${escHtml(m.Department)}</div>
        <div class="mgmt-salary">💰 ${fmtSalary(m.Salary)}</div>
      </div>
      <div class="mgmt-badge">
        <div class="mgmt-reports-count">${m.DirectReports}</div>
        <div class="mgmt-reports-lbl">direct reports</div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('management-grid').innerHTML = cards;
}

// ── Sidebar Navigation ────────────────────────────────────────
function initNav() {
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      if (item.dataset.view === 'settings') { openConnModal(); return; }

      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      closeDrill();
      clearNLSearch();

      if (window._dbConnected) {
        switchView(item.dataset.view);
      }
    });
  });
}

// ── Toast Notifications ───────────────────────────────────────
let _toastTimer = null;
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const icon  = document.getElementById('toast-icon');
  const msgEl = document.getElementById('toast-msg');

  icon.textContent  = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  msgEl.textContent = msg;
  toast.className   = `show ${type}`;

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { toast.className = ''; }, 3500);
}
