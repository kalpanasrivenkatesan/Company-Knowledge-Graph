// ============================================================
// drillthrough.js — Slide-in drill panel with breadcrumbs
// ============================================================

const drillStack = [];   // breadcrumb history

// ── Open / Close Panel ────────────────────────────────────────
function openDrill(title, subtitle, bodyHTML, breadcrumb) {
  document.getElementById('drill-title').textContent = title;
  document.getElementById('drill-sub').textContent   = subtitle || '';
  document.getElementById('drill-body').innerHTML    = bodyHTML;
  renderBreadcrumb(breadcrumb);
  document.getElementById('drill-panel').classList.add('open');
}

function closeDrill() {
  document.getElementById('drill-panel').classList.remove('open');
  drillStack.length = 0;
  renderBreadcrumb([]);
}

// ── Breadcrumb ────────────────────────────────────────────────
function renderBreadcrumb(items) {
  const el = document.getElementById('drill-breadcrumb');
  el.innerHTML = '';
  items.forEach((item, i) => {
    const span = document.createElement('span');
    span.className = 'drill-bc-item' + (i === items.length - 1 ? ' active' : '');
    span.textContent = item.label;
    if (i < items.length - 1 && item.onClick) span.onclick = item.onClick;
    el.appendChild(span);
    if (i < items.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'drill-bc-sep'; sep.textContent = '›';
      el.appendChild(sep);
    }
  });
}

// ── Format helpers ────────────────────────────────────────────
function fmtSalary(v) { return v ? '$' + Number(v).toLocaleString() : '—'; }
function fmtDate(v)   { return v ? v.substring(0,10) : '—'; }
function initials(name) {
  return name ? name.split(' ').map(n=>n[0]).join('').toUpperCase().substring(0,2) : '??';
}
function statusPill(s) {
  const cls = { 'In Progress':'inprogress', 'Completed':'completed', 'Planning':'planning', 'On Hold':'onhold' };
  return `<span class="status-pill ${cls[s]||''}">${s}</span>`;
}

// ── Drill: Department ─────────────────────────────────────────
async function drillDepartment(deptId, deptName, mode) {
  const loading = `<div class="loading-state"><div class="spinner"></div> Loading employees…</div>`;
  openDrill(deptName, 'Department Employees', loading, [
    { label: 'Overview' }, { label: deptName }
  ]);

  const data = await fetchJSON(`/api/drill/department/${deptId}`);
  if (!data) return;

  const rows = data.map(e => `
    <tr onclick="drillEmployee(${e.EmployeeID},'${escHtml(e.Name)}')">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="drill-avatar" style="width:30px;height:30px;font-size:12px;">${initials(e.Name)}</div>
          <div>
            <div style="font-weight:600;font-size:12.5px">${escHtml(e.Name)}</div>
            <div style="color:var(--text2);font-size:11px">${escHtml(e.JobTitle)}</div>
          </div>
        </div>
      </td>
      <td class="salary-cell">${fmtSalary(e.Salary)}</td>
      <td>${escHtml(e.ManagerName || 'N/A')}</td>
      <td>${fmtDate(e.HireDate)}</td>
    </tr>`).join('');

  const body = `
    <div style="margin-bottom:10px;font-size:12px;color:var(--text2)">${data.length} employees found</div>
    <table class="drill-table">
      <thead><tr><th>Employee</th><th>Salary</th><th>Manager</th><th>Hired</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  openDrill(deptName, `${data.length} active employees`, body, [
    { label: 'Overview', onClick: closeDrill }, { label: deptName }
  ]);
}

// ── Drill: Manager's Reports ──────────────────────────────────
async function drillManager(managerId, managerName) {
  const loading = `<div class="loading-state"><div class="spinner"></div> Loading direct reports…</div>`;
  openDrill(managerName, 'Direct Reports', loading, [
    { label: 'Overview' }, { label: 'Managers' }, { label: managerName }
  ]);

  const data = await fetchJSON(`/api/drill/manager/${managerId}`);
  if (!data) return;

  const rows = data.map(e => `
    <tr onclick="drillEmployee(${e.EmployeeID},'${escHtml(e.Name)}')">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="drill-avatar" style="width:30px;height:30px;font-size:12px;">${initials(e.Name)}</div>
          <div>
            <div style="font-weight:600;font-size:12.5px">${escHtml(e.Name)}</div>
            <div style="color:var(--text2);font-size:11px">${escHtml(e.JobTitle)}</div>
          </div>
        </div>
      </td>
      <td style="color:var(--text2);font-size:12px">${escHtml(e.Department)}</td>
      <td class="salary-cell">${fmtSalary(e.Salary)}</td>
      <td style="color:var(--cyan)">${e.ProjectCount} project${e.ProjectCount!==1?'s':''}</td>
    </tr>`).join('');

  const body = `
    <div style="margin-bottom:10px;font-size:12px;color:var(--text2)">${data.length} direct reports</div>
    <table class="drill-table">
      <thead><tr><th>Employee</th><th>Department</th><th>Salary</th><th>Projects</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  openDrill(`${managerName}'s Team`, `${data.length} direct reports`, body, [
    { label: 'Overview', onClick: closeDrill }, { label: 'Managers' }, { label: managerName }
  ]);
}

// ── Drill: Project (team members) ────────────────────────────
async function drillProject(projectId, projectName) {
  const loading = `<div class="loading-state"><div class="spinner"></div> Loading project team…</div>`;
  openDrill(projectName, 'Project Team', loading, [
    { label: 'Overview' }, { label: 'Projects' }, { label: projectName }
  ]);

  const data = await fetchJSON(`/api/drill/project/${projectId}`);
  if (!data) return;

  const rows = data.map(e => `
    <tr onclick="drillEmployee(${e.EmployeeID},'${escHtml(e.Name)}')">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="drill-avatar" style="width:30px;height:30px;font-size:12px;">${initials(e.Name)}</div>
          <div>
            <div style="font-weight:600;font-size:12.5px">${escHtml(e.Name)}</div>
            <div style="color:var(--text2);font-size:11px">${escHtml(e.JobTitle)}</div>
          </div>
        </div>
      </td>
      <td style="color:var(--violet)">${escHtml(e.Role)}</td>
      <td style="color:var(--text2)">${escHtml(e.Department)}</td>
      <td style="color:var(--amber)">${e.HoursAllocated}h</td>
    </tr>`).join('');

  const body = `
    <div style="margin-bottom:10px;font-size:12px;color:var(--text2)">${data.length} team members</div>
    <table class="drill-table">
      <thead><tr><th>Member</th><th>Role</th><th>Department</th><th>Hours</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  openDrill(projectName, `${data.length} team members`, body, [
    { label: 'Overview', onClick: closeDrill }, { label: 'Projects' }, { label: projectName }
  ]);
}

// ── Drill: Project Status ─────────────────────────────────────
async function drillProjectStatus(status) {
  const loading = `<div class="loading-state"><div class="spinner"></div> Loading projects…</div>`;
  openDrill(status + ' Projects', 'Project List', loading, [
    { label: 'Overview' }, { label: status }
  ]);

  const data = await fetchJSON(`/api/drill/project-status/${encodeURIComponent(status)}`);
  if (!data) return;

  const rows = data.map(p => `
    <tr onclick="drillProject(${p.ProjectID},'${escHtml(p.Name)}')">
      <td>
        <div style="font-weight:600;font-size:12.5px">${escHtml(p.Name)}</div>
        <div style="color:var(--text2);font-size:11px">${escHtml(p.Department)}</div>
      </td>
      <td class="salary-cell">$${(p.Budget/1000).toFixed(0)}k</td>
      <td style="color:var(--text2);font-size:11.5px">${fmtDate(p.StartDate)} → ${fmtDate(p.EndDate)}</td>
      <td style="color:var(--cyan)">${p.TeamSize} members</td>
    </tr>`).join('');

  const body = `
    <div style="margin-bottom:10px;font-size:12px;color:var(--text2)">${data.length} ${status} projects</div>
    <table class="drill-table">
      <thead><tr><th>Project</th><th>Budget</th><th>Timeline</th><th>Team</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  openDrill(status + ' Projects', `${data.length} projects`, body, [
    { label: 'Overview', onClick: closeDrill }, { label: status }
  ]);
}

// ── Drill: Employee Detail ────────────────────────────────────
async function drillEmployee(empId, empName) {
  const loading = `<div class="loading-state"><div class="spinner"></div> Loading employee profile…</div>`;
  const panel   = document.getElementById('drill-panel');
  const prevTitle = document.getElementById('drill-title').textContent;
  const prevSub   = document.getElementById('drill-sub').textContent;
  const prevBody  = document.getElementById('drill-body').innerHTML;
  const prevBC    = document.getElementById('drill-breadcrumb').innerHTML;

  document.getElementById('drill-body').innerHTML = loading;
  document.getElementById('drill-title').textContent = empName;
  document.getElementById('drill-sub').textContent   = 'Employee Profile';

  const result = await fetchJSON(`/api/drill/employee/${empId}`);
  if (!result) return;
  const { employee: e, projects } = result;

  const projRows = projects.length ? projects.map(p => `
    <tr onclick="drillProject(${p.ProjectID},'${escHtml(p.Project)}')">
      <td style="font-weight:600;font-size:12px">${escHtml(p.Project)}</td>
      <td style="color:var(--violet)">${escHtml(p.Role)}</td>
      <td style="color:var(--amber)">${p.HoursAllocated}h</td>
      <td>${statusPill(p.Status)}</td>
    </tr>`).join('') : `<tr><td colspan="4" style="color:var(--text3);text-align:center;padding:20px">No projects assigned</td></tr>`;

  const body = `
    <div class="drill-emp-card">
      <div class="drill-avatar">${initials(e.Name)}</div>
      <div class="drill-emp-info">
        <div class="drill-emp-name">${escHtml(e.Name)}</div>
        <div class="drill-emp-title">${escHtml(e.JobTitle)}</div>
        <div class="drill-emp-meta">
          <div class="drill-meta-item">🏢 <strong>${escHtml(e.Department)}</strong></div>
          <div class="drill-meta-item">👔 <strong>${escHtml(e.ManagerName || 'CEO')}</strong></div>
          <div class="drill-meta-item">💰 <strong class="salary-cell">${fmtSalary(e.Salary)}</strong></div>
          <div class="drill-meta-item">📅 Hired <strong>${fmtDate(e.HireDate)}</strong></div>
          <div class="drill-meta-item">✉️ <strong>${escHtml(e.Email || '—')}</strong></div>
          <div class="drill-meta-item">📞 <strong>${escHtml(e.Phone || '—')}</strong></div>
        </div>
      </div>
    </div>
    <div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--text)">
      📁 Project Assignments <span style="color:var(--cyan);font-weight:400;font-size:11px">(click to drill into project)</span>
    </div>
    <table class="drill-table">
      <thead><tr><th>Project</th><th>Role</th><th>Hours</th><th>Status</th></tr></thead>
      <tbody>${projRows}</tbody>
    </table>`;

  document.getElementById('drill-body').innerHTML = body;
  document.getElementById('drill-sub').textContent = `${projects.length} project(s) assigned`;

  // Add back button to breadcrumb
  const bc = document.getElementById('drill-breadcrumb');
  const backItem = document.createElement('span');
  backItem.className = 'drill-bc-item';
  backItem.textContent = '‹ Back';
  backItem.style.color = 'var(--indigo)';
  backItem.onclick = () => {
    document.getElementById('drill-title').textContent = prevTitle;
    document.getElementById('drill-sub').textContent   = prevSub;
    document.getElementById('drill-body').innerHTML    = prevBody;
    document.getElementById('drill-breadcrumb').innerHTML = prevBC;
  };
  bc.innerHTML = '';
  bc.appendChild(backItem);
  const sep = document.createElement('span'); sep.className = 'drill-bc-sep'; sep.textContent = '›'; bc.appendChild(sep);
  const cur = document.createElement('span'); cur.className = 'drill-bc-item active'; cur.textContent = e.Name; bc.appendChild(cur);
}

// ── Drill: Job Title ──────────────────────────────────────────
async function drillJobTitle(title) {
  showToast(`Searching for ${title}…`, 'info');
  try {
    const r = await fetch(`${API}/api/nl-query`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query: `show ${title}` }),
    });
    if (!r.ok) throw new Error('Server error ' + r.status);
    const data = await r.json();
    renderNLResults(data);
  } catch (e) {
    showToast('Search failed: ' + e.message, 'error');
  }
}

// ── Escape HTML ───────────────────────────────────────────────
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
