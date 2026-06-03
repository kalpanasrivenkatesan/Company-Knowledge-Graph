// ============================================================
// nl-search.js — Natural Language search box & results
// ============================================================

const nlInput = document.getElementById('nl-input');
const nlSuggs = document.getElementById('nl-suggestions');

// ── Show / hide suggestions ───────────────────────────────────
nlInput.addEventListener('focus', () => {
  if (!nlInput.value.trim()) nlSuggs.style.display = 'block';
});
nlInput.addEventListener('input', () => {
  nlSuggs.style.display = nlInput.value.trim() ? 'none' : 'block';
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('#nl-search-wrap')) nlSuggs.style.display = 'none';
});
nlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runNLSearch();
});
document.getElementById('nl-search-btn').addEventListener('click', runNLSearch);

// ── Chip clicks ───────────────────────────────────────────────
document.querySelectorAll('.nl-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    nlInput.value = chip.dataset.q;
    nlSuggs.style.display = 'none';
    runNLSearch();
  });
});

// ── Run NL search ─────────────────────────────────────────────
async function runNLSearch() {
  const q = nlInput.value.trim();
  if (!q) return;

  if (!window._dbConnected) {
    showToast('Please connect to SQL Server first!', 'error');
    return;
  }

  nlSuggs.style.display = 'none';
  showToast('Searching…', 'info');

  try {
    const r = await fetch(`${API}/api/nl-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
    });
    if (!r.ok) throw new Error('Server error');
    const data = await r.json();
    renderNLResults(data);
    showToast(`Found ${data.data.length} result(s)`, 'success');
  } catch (e) {
    showToast('Search failed: ' + e.message, 'error');
  }
}

// ── Render NL results ─────────────────────────────────────────
function renderNLResults(data) {
  const banner = document.getElementById('nl-banner');
  document.getElementById('nl-query-display').textContent = `"${data.query}"`;
  document.getElementById('nl-sql-display').textContent   = data.generatedSQL;
  document.getElementById('nl-sql-display').title         = data.generatedSQL;
  banner.classList.add('visible');

  if (data.type === 'person') {

  renderNLPerson(data.data);

  } else if (data.type === 'employees') {

  renderNLEmployees(data.data);

  } else {

  renderNLProjects(data.data);

  }
}

// ── Render NL employee results in drill panel ─────────────────
function renderNLEmployees(employees) {
  if (!employees.length) {
    openDrill('Search Results', 'No employees found', `
      <div style="text-align:center;padding:40px;color:var(--text3)">
        <div style="font-size:40px;margin-bottom:12px">🔍</div>
        <p>No employees match your query. Try a different search.</p>
      </div>`, [{ label: 'Search' }, { label: 'Results' }]);
    return;
  }

  const rows = employees.map(e => `
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
      <td style="color:var(--text2);font-size:11.5px">${escHtml(e.ManagerName || '—')}</td>
      <td style="color:var(--text3);font-size:11px">${e.HireDate ? e.HireDate.substring(0,10) : '—'}</td>
    </tr>`).join('');

  const body = `
    <div style="margin-bottom:10px;font-size:12px;color:var(--text2)">${employees.length} employees found · click any row to view profile</div>
    <table class="drill-table">
      <thead><tr><th>Employee</th><th>Department</th><th>Salary</th><th>Manager</th><th>Hired</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  openDrill('Search Results', `${employees.length} employees`, body, [
    { label: 'Search', onClick: closeDrill }, { label: 'Employees' }
  ]);
}

// ── Render NL project results in drill panel ──────────────────
function renderNLProjects(projects) {
  if (!projects.length) {
    openDrill('Search Results', 'No projects found', `
      <div style="text-align:center;padding:40px;color:var(--text3)">
        <div style="font-size:40px;margin-bottom:12px">🔍</div>
        <p>No projects match your query. Try a different search.</p>
      </div>`, [{ label: 'Search' }, { label: 'Results' }]);
    return;
  }

  const rows = projects.map(p => `
    <tr onclick="drillProject(${p.ProjectID},'${escHtml(p.Name)}')">
      <td>
        <div style="font-weight:600;font-size:12.5px">${escHtml(p.Name)}</div>
        <div style="color:var(--text2);font-size:11px">${escHtml(p.Department)}</div>
      </td>
      <td>${statusPill(p.Status)}</td>
      <td class="salary-cell">$${(p.Budget/1000).toFixed(0)}k</td>
      <td style="color:var(--text2);font-size:11px">${p.StartDate||'—'} → ${p.EndDate||'—'}</td>
      <td style="color:var(--cyan)">${p.TeamSize} members</td>
    </tr>`).join('');

  const body = `
    <div style="margin-bottom:10px;font-size:12px;color:var(--text2)">${projects.length} projects found · click any row to see team</div>
    <table class="drill-table">
      <thead><tr><th>Project</th><th>Status</th><th>Budget</th><th>Timeline</th><th>Team</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  openDrill('Project Search', `${projects.length} projects`, body, [
    { label: 'Search', onClick: closeDrill }, { label: 'Projects' }
  ]);
}

// ── Clear NL search ───────────────────────────────────────────
function clearNLSearch() {
  nlInput.value = '';
  document.getElementById('nl-banner').classList.remove('visible');
  closeDrill();
}
function renderNLPerson(rows) {

  if (!rows.length) {

    openDrill(
      'Knowledge Graph',
      'No relationship data found',
      `
      <div style="padding:30px;text-align:center">
        No employee found.
      </div>
      `,
      [{ label: 'Close' }]
    );

    return;
  }

  const r = rows[0];

  let html = `

    <div style="
      background:#111827;
      border:1px solid #374151;
      border-radius:14px;
      padding:20px;
      line-height:2;
      font-size:15px;
    ">

      <div style="
        font-size:22px;
        color:#22d3ee;
        font-weight:bold;
        margin-bottom:20px;
      ">
        ${escHtml(r.Name)}
      </div>

  `;

  // Employee → Department
  html += `
    <div>
      🔗
      <strong>${escHtml(r.Name)}</strong>

      <span style="color:#22c55e">
        WORKS_IN
      </span>

      <strong>${escHtml(r.Department || 'N/A')}</strong>
    </div>
  `;

  // Employee → Manager
  html += `
    <div>
      🔗
      <strong>${escHtml(r.Name)}</strong>

      <span style="color:#f59e0b">
        REPORTS_TO
      </span>

      <strong>${escHtml(r.ManagerName || 'N/A')}</strong>
    </div>
  `;

  // Employee → Role
  html += `
    <div>
      🔗
      <strong>${escHtml(r.Name)}</strong>

      <span style="color:#a855f7">
        HAS_ROLE
      </span>

      <strong>${escHtml(r.JobTitle || 'N/A')}</strong>
    </div>
  `;

  // Projects
  rows.forEach(p => {

    if (p.ProjectName) {

      html += `
        <div>
          🔗
          <strong>${escHtml(r.Name)}</strong>

          <span style="color:#06b6d4">
            WORKS_ON
          </span>

          <strong>${escHtml(p.ProjectName)}</strong>
        </div>
      `;

      html += `
        <div style="margin-left:28px">
          ↳ ROLE_IN_PROJECT :
          <strong>${escHtml(p.ProjectRole || 'N/A')}</strong>
        </div>
      `;

      html += `
        <div style="margin-left:28px">
          ↳ PROJECT_STATUS :
          <strong>${escHtml(p.ProjectStatus || 'N/A')}</strong>
        </div>
      `;
    }

  });

  html += `</div>`;

  openDrill(
    'Knowledge Graph Relationships',
    'Employee Connected Nodes',
    html,
    [{ label: 'Close' }]
  );
}