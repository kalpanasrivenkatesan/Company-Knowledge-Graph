// ============================================================
// Company Analytics Dashboard — Express API Server
// SQL Server via Tedious (Windows Auth / SQL Auth)
// ============================================================
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const { Connection, Request, TYPES } = require('tedious');

const app  = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// ── Connection state ───────────────────────────────────────────
let dbConfig  = null;
let connected = false;

// ── Build tedious config ──────────────────────────────────────
// Supports Windows NTLM auth and SQL Server auth
function buildConfig({ server, database, domain, userName, password, authType }) {
  const base = {
    server: 'localhost',
    options: {
      instanceName: 'SQLEXPRESS',
      database,
      trustServerCertificate: true,
      encrypt: false,
      connectTimeout: 15000,
      rowCollectionOnDone: true,
    },
  };

  if (authType === 'sql') {
    // SQL Server Authentication
    return {
      ...base,
      authentication: {
        type: 'default',
        options: {
          userName: userName || '',
          password: password || '',
        },
      },
    };
  }

  // Windows NTLM Authentication (default)
  return {
    ...base,
    authentication: {
      type: 'ntlm',
      options: {
        domain:   domain   || '',
        userName: userName || '',
        password: password || '',
      },
    },
  };
}

// ── Open a connection, run query, close ───────────────────────
function execQuery(sql, params = {}) {
  return new Promise((resolve, reject) => {
    if (!dbConfig) return reject(new Error('Not connected to database.'));

    const conn = new Connection(dbConfig);

    conn.on('connect', (err) => {
      if (err) return reject(err);

      const results = [];
      const req = new Request(sql, (qErr) => {
        conn.close();
        if (qErr) reject(qErr);
        else      resolve(results);
      });

      // Bind typed parameters
      for (const [name, { type, value }] of Object.entries(params)) {
        req.addParameter(name, type, value);
      }

      req.on('row', (cols) => {
        const row = {};
        cols.forEach(c => { row[c.metadata.colName] = c.value; });
        results.push(row);
      });

      conn.execSql(req);
    });

    conn.on('error', (err) => console.error('Tedious error:', err.message));
    conn.connect();
  });
}

// ── Test connection (no query) ────────────────────────────────
function testConnection(cfg) {
  return new Promise((resolve, reject) => {
    const conn = new Connection(cfg);
    conn.on('connect', (err) => {
      conn.close();
      if (err) reject(err);
      else     resolve(true);
    });
    conn.on('error', () => {});
    conn.connect();
  });
}

// ─────────────────────────────────────────────────────────────────
// STATUS & CONNECT ROUTES
// ─────────────────────────────────────────────────────────────────

app.get('/api/status', (req, res) => {
  res.json({
    connected,
    server:   dbConfig?.server                || null,
    database: dbConfig?.options?.database     || null,
  });
});

app.post('/api/connect', async (req, res) => {
  const {
    server   = 'localhost',
    database = 'CompanyDB',
    domain   = '',
    userName = '',
    password = '',
    authType = 'windows',
  } = req.body;

  const cfg = buildConfig({ server, database, domain, userName, password, authType });
  try {
    await testConnection(cfg);
    dbConfig  = cfg;
    connected = true;
    res.json({ success: true, message: `Connected to ${server}/${database}` });
  } catch (err) {
    connected = false;
    dbConfig  = null;
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/disconnect', (req, res) => {
  dbConfig  = null;
  connected = false;
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────
// OVERVIEW KPIs
// ─────────────────────────────────────────────────────────────────
app.get('/api/overview', async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT
        (SELECT COUNT(*) FROM Employees WHERE Status='Active')                          AS TotalEmployees,
        (SELECT COUNT(*) FROM Departments)                                              AS TotalDepartments,
        (SELECT COUNT(*) FROM Projects)                                                 AS TotalProjects,
        (SELECT COUNT(*) FROM Projects WHERE Status='In Progress')                      AS ActiveProjects,
        (SELECT CAST(ROUND(AVG(Salary),0) AS INT) FROM Employees WHERE Status='Active') AS AvgSalary,
        (SELECT COUNT(DISTINCT ManagerID) FROM Employees WHERE ManagerID IS NOT NULL)   AS TotalManagers`);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────
// CHART DATA ROUTES
// ─────────────────────────────────────────────────────────────────

app.get('/api/chart/dept-employees', async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT d.DepartmentID, d.Name AS Department, COUNT(e.EmployeeID) AS EmployeeCount
      FROM Departments d LEFT JOIN Employees e ON e.DepartmentID=d.DepartmentID AND e.Status='Active'
      GROUP BY d.DepartmentID, d.Name ORDER BY EmployeeCount DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/chart/dept-salary', async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT d.DepartmentID, d.Name AS Department,
             CAST(ROUND(AVG(e.Salary),0) AS INT) AS AvgSalary,
             CAST(MIN(e.Salary) AS INT) AS MinSalary,
             CAST(MAX(e.Salary) AS INT) AS MaxSalary
      FROM Departments d JOIN Employees e ON e.DepartmentID=d.DepartmentID AND e.Status='Active'
      GROUP BY d.DepartmentID, d.Name ORDER BY AvgSalary DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/chart/project-status', async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT Status, COUNT(*) AS ProjectCount,
             CAST(SUM(Budget) AS BIGINT) AS TotalBudget
      FROM Projects GROUP BY Status ORDER BY ProjectCount DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/chart/manager-span', async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT m.EmployeeID AS ManagerID,
             m.FirstName + ' ' + m.LastName AS ManagerName,
             m.JobTitle,
             COUNT(e.EmployeeID) AS DirectReports
      FROM Employees m JOIN Employees e ON e.ManagerID=m.EmployeeID
      GROUP BY m.EmployeeID, m.FirstName, m.LastName, m.JobTitle
      ORDER BY DirectReports DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/chart/project-budget', async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT ProjectID, Name, CAST(Budget AS INT) AS Budget, Status,
             DATEDIFF(DAY, StartDate, EndDate) AS DurationDays
      FROM Projects ORDER BY Budget DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/chart/job-titles', async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT JobTitle, COUNT(*) AS Count,
             CAST(ROUND(AVG(Salary),0) AS INT) AS AvgSalary
      FROM Employees WHERE Status='Active'
      GROUP BY JobTitle ORDER BY Count DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────
// FULL LIST ROUTES  (for Employees / Departments / Projects / Management views)
// ─────────────────────────────────────────────────────────────────

// All employees (active + inactive)
app.get('/api/employees', async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT e.EmployeeID,
             e.FirstName + ' ' + e.LastName           AS Name,
             e.JobTitle,
             CAST(e.Salary AS INT)                    AS Salary,
             CONVERT(VARCHAR, e.HireDate, 23)         AS HireDate,
             e.Email, e.Phone, e.Status,
             d.Name                                   AS Department,
             m.FirstName + ' ' + m.LastName           AS ManagerName
      FROM Employees e
      JOIN  Departments d ON d.DepartmentID = e.DepartmentID
      LEFT JOIN Employees m ON m.EmployeeID = e.ManagerID
      ORDER BY e.Status, e.Salary DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// All departments with headcount + salary stats
app.get('/api/departments', async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT d.DepartmentID, d.Name, d.Location,
             CAST(d.Budget AS BIGINT)                            AS Budget,
             CONVERT(VARCHAR, d.EstablishedDate, 23)            AS EstablishedDate,
             COUNT(e.EmployeeID)                                 AS EmployeeCount,
             CAST(ROUND(AVG(e.Salary), 0) AS INT)               AS AvgSalary,
             CAST(MIN(e.Salary) AS INT)                         AS MinSalary,
             CAST(MAX(e.Salary) AS INT)                         AS MaxSalary
      FROM Departments d
      LEFT JOIN Employees e ON e.DepartmentID = d.DepartmentID AND e.Status = 'Active'
      GROUP BY d.DepartmentID, d.Name, d.Location, d.Budget, d.EstablishedDate
      ORDER BY EmployeeCount DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// All projects with team size
app.get('/api/projects', async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT p.ProjectID, p.Name, p.Status,
             CAST(p.Budget AS INT)                                AS Budget,
             CONVERT(VARCHAR, p.StartDate, 23)                   AS StartDate,
             CONVERT(VARCHAR, p.EndDate,   23)                   AS EndDate,
             d.Name                                              AS Department,
             (SELECT COUNT(*) FROM ProjectAssignments pa
              WHERE pa.ProjectID = p.ProjectID)                  AS TeamSize
      FROM Projects p
      JOIN Departments d ON d.DepartmentID = p.DepartmentID
      ORDER BY p.Budget DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Managers with direct report counts
app.get('/api/management', async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT m.EmployeeID                              AS ManagerID,
             m.FirstName + ' ' + m.LastName           AS ManagerName,
             m.JobTitle,
             CAST(m.Salary AS INT)                    AS Salary,
             d.Name                                   AS Department,
             COUNT(e.EmployeeID)                      AS DirectReports
      FROM Employees m
      JOIN Employees e ON e.ManagerID = m.EmployeeID
      JOIN Departments d ON d.DepartmentID = m.DepartmentID
      GROUP BY m.EmployeeID, m.FirstName, m.LastName, m.JobTitle, m.Salary, d.Name
      ORDER BY DirectReports DESC, m.Salary DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────
// DRILL-THROUGH ROUTES
// ─────────────────────────────────────────────────────────────────

app.get('/api/drill/department/:id', async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT e.EmployeeID, e.FirstName+' '+e.LastName AS Name, e.JobTitle,
             CAST(e.Salary AS INT) AS Salary,
             CONVERT(VARCHAR,e.HireDate,23) AS HireDate, e.Email,
             m.FirstName+' '+m.LastName AS ManagerName, e.Status
      FROM Employees e LEFT JOIN Employees m ON m.EmployeeID=e.ManagerID
      WHERE e.DepartmentID=@id AND e.Status='Active'
      ORDER BY e.Salary DESC`,
      { id: { type: TYPES.Int, value: parseInt(req.params.id) } });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/drill/project/:id', async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT e.EmployeeID, e.FirstName+' '+e.LastName AS Name, e.JobTitle,
             pa.Role, pa.HoursAllocated, d.Name AS Department
      FROM ProjectAssignments pa
      JOIN Employees   e ON e.EmployeeID=pa.EmployeeID
      JOIN Departments d ON d.DepartmentID=e.DepartmentID
      WHERE pa.ProjectID=@id ORDER BY pa.HoursAllocated DESC`,
      { id: { type: TYPES.Int, value: parseInt(req.params.id) } });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/drill/manager/:id', async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT e.EmployeeID, e.FirstName+' '+e.LastName AS Name, e.JobTitle,
             CAST(e.Salary AS INT) AS Salary, d.Name AS Department,
             CONVERT(VARCHAR,e.HireDate,23) AS HireDate,
             (SELECT COUNT(*) FROM ProjectAssignments pa WHERE pa.EmployeeID=e.EmployeeID) AS ProjectCount
      FROM Employees e JOIN Departments d ON d.DepartmentID=e.DepartmentID
      WHERE e.ManagerID=@id ORDER BY e.Salary DESC`,
      { id: { type: TYPES.Int, value: parseInt(req.params.id) } });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/drill/employee/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [emp, projects] = await Promise.all([
      execQuery(`
        SELECT e.EmployeeID, e.FirstName+' '+e.LastName AS Name, e.JobTitle, e.Email,
               e.Phone, CAST(e.Salary AS INT) AS Salary,
               CONVERT(VARCHAR,e.HireDate,23) AS HireDate,
               d.Name AS Department,
               m.FirstName+' '+m.LastName AS ManagerName, e.Status
        FROM Employees e
        JOIN Departments d ON d.DepartmentID=e.DepartmentID
        LEFT JOIN Employees m ON m.EmployeeID=e.ManagerID
        WHERE e.EmployeeID=@id`,
        { id: { type: TYPES.Int, value: id } }),
      execQuery(`
        SELECT p.ProjectID, p.Name AS Project, pa.Role, pa.HoursAllocated, p.Status
        FROM ProjectAssignments pa JOIN Projects p ON p.ProjectID=pa.ProjectID
        WHERE pa.EmployeeID=@id ORDER BY p.Status`,
        { id: { type: TYPES.Int, value: id } }),
    ]);
    res.json({ employee: emp[0], projects });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/drill/project-status/:status', async (req, res) => {
  try {
    const rows = await execQuery(`
      SELECT p.ProjectID, p.Name, p.Status, CAST(p.Budget AS INT) AS Budget,
             CONVERT(VARCHAR,p.StartDate,23) AS StartDate,
             CONVERT(VARCHAR,p.EndDate,23) AS EndDate,
             d.Name AS Department,
             (SELECT COUNT(*) FROM ProjectAssignments pa WHERE pa.ProjectID=p.ProjectID) AS TeamSize
      FROM Projects p JOIN Departments d ON d.DepartmentID=p.DepartmentID
      WHERE p.Status=@status ORDER BY p.Budget DESC`,
      { status: { type: TYPES.NVarChar, value: req.params.status } });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────
// NATURAL LANGUAGE QUERY
// ─────────────────────────────────────────────────────────────────
app.post('/api/nl-query', async (req, res) => {
  const { query: nlQuery } = req.body;
  if (!nlQuery) return res.status(400).json({ error: 'Query required' });

  const q    = nlQuery.toLowerCase().trim();
  const cond = [];
  let   base = 'employees';
  let   topN = '';
  let personSearch = null;

  const infoMatch = q.match(
  /(?:give me all info about|show info about)\s+(.+)/i
  );

  if (infoMatch) {
  personSearch = infoMatch[1].trim();
  }
  // Detect intent
  if (/\bprojects?\b/.test(q) && !/assigned to|working on/.test(q)) base = 'projects';
  if (/in progress|completed|planning|on hold/.test(q)) base = 'projects';

  // TOP N
  const topMatch = q.match(/top\s+(\d+)/);
  if (topMatch) topN = `TOP ${topMatch[1]}`;

  if (base === 'employees') {
    if (personSearch) {

       const sqlText = `

      SELECT
      e.EmployeeID,

      e.FirstName + ' ' + e.LastName AS Name,

      e.JobTitle,

      d.Name AS Department,

      CAST(e.Salary AS INT) AS Salary,

      m.FirstName + ' ' + m.LastName AS ManagerName,

      p.Name AS ProjectName,

      pa.Role AS ProjectRole,

      p.Status AS ProjectStatus

    FROM Employees e

    LEFT JOIN Departments d
      ON d.DepartmentID = e.DepartmentID

    LEFT JOIN Employees m
      ON m.EmployeeID = e.ManagerID

    LEFT JOIN ProjectAssignments pa
      ON pa.EmployeeID = e.EmployeeID

    LEFT JOIN Projects p
      ON p.ProjectID = pa.ProjectID

    WHERE
      LOWER(e.FirstName + ' ' + e.LastName)
      LIKE LOWER('%${personSearch}%')

    ORDER BY p.Name

  `;

  try {

    const data = await execQuery(sqlText);

    return res.json({
      type: 'person',
      data,
      generatedSQL: sqlText.replace(/\s+/g, ' ').trim(),
      query: nlQuery
    });

  } catch (e) {

    return res.status(500).json({
      error: e.message
    });

  }

}
    const deptMap = {
      engineering:      'Engineering',
      marketing:        'Marketing',
      sales:            'Sales',
      finance:          'Finance',
      'human resources':'Human Resources',
      hr:               'Human Resources',
    };
    for (const [k, v] of Object.entries(deptMap)) {
      if (q.includes(k)) { cond.push(`d.Name = '${v}'`); break; }
    }
    const salGt = q.match(/salary\s+(?:above|over|greater than|more than)\s+(\d+)/);
    if (salGt) cond.push(`e.Salary > ${salGt[1]}`);
    const salLt = q.match(/salary\s+(?:below|under|less than)\s+(\d+)/);
    if (salLt) cond.push(`e.Salary < ${salLt[1]}`);
    if (/\bsenior\b/.test(q)) cond.push(`e.JobTitle LIKE '%Senior%'`);
    if (/\bjunior\b/.test(q)) cond.push(`e.JobTitle LIKE '%Junior%'`);
    const titles = ['developer','manager','engineer','analyst','specialist','recruiter','accountant','writer','devops','qa'];
    for (const t of titles) {
      if (new RegExp(`\\b${t}s?\\b`).test(q)) { cond.push(`e.JobTitle LIKE '%${t}%'`); break; }
    }
    if (/\bmanagers?\b/.test(q) && !cond.some(c => c.includes('JobTitle')))
      cond.push(`(e.JobTitle LIKE '%Manager%' OR e.JobTitle LIKE '%VP%' OR e.JobTitle LIKE '%CEO%')`);
    const yearAfter  = q.match(/hired?\s+after\s+(\d{4})/);  if (yearAfter)  cond.push(`YEAR(e.HireDate) > ${yearAfter[1]}`);
    const yearBefore = q.match(/hired?\s+before\s+(\d{4})/); if (yearBefore) cond.push(`YEAR(e.HireDate) < ${yearBefore[1]}`);
    const yearIn     = q.match(/hired?\s+in\s+(\d{4})/);     if (yearIn)     cond.push(`YEAR(e.HireDate) = ${yearIn[1]}`);

    let orderBy = 'e.Salary DESC';
    if (/newest|latest|recent/.test(q)) orderBy = 'e.HireDate DESC';
    if (/oldest/.test(q)) orderBy = 'e.HireDate ASC';

    const where   = cond.length ? 'AND ' + cond.join(' AND ') : '';
    const sqlText = `SELECT ${topN} e.EmployeeID, e.FirstName+' '+e.LastName AS Name, e.JobTitle,
      CAST(e.Salary AS INT) AS Salary, d.Name AS Department,
      CONVERT(VARCHAR,e.HireDate,23) AS HireDate,
      m.FirstName+' '+m.LastName AS ManagerName
      FROM Employees e
      JOIN Departments d ON d.DepartmentID=e.DepartmentID
      LEFT JOIN Employees m ON m.EmployeeID=e.ManagerID
      WHERE e.Status='Active' ${where} ORDER BY ${orderBy}`;
    try {
      const data = await execQuery(sqlText);
      res.json({ type: 'employees', data, generatedSQL: sqlText.replace(/\s+/g, ' ').trim(), query: nlQuery });
    } catch (e) { res.status(500).json({ error: e.message }); }

  } else {
    const statusMap = {
      'in progress': 'In Progress',
      'completed':   'Completed',
      'planning':    'Planning',
      'on hold':     'On Hold',
    };
    for (const [k, v] of Object.entries(statusMap)) {
      if (q.includes(k)) { cond.push(`p.Status = '${v}'`); break; }
    }
    const deptKw = q.match(/\b(engineering|marketing|sales|finance|hr)\b/);
    if (deptKw) cond.push(`d.Name LIKE '%${deptKw[1]}%'`);

    let orderBy = 'p.Budget DESC';
    if (/recent|latest/.test(q)) orderBy = 'p.StartDate DESC';

    const where   = cond.length ? 'AND ' + cond.join(' AND ') : '';
    const sqlText = `SELECT ${topN} p.ProjectID, p.Name, p.Status, CAST(p.Budget AS INT) AS Budget,
      CONVERT(VARCHAR,p.StartDate,23) AS StartDate, CONVERT(VARCHAR,p.EndDate,23) AS EndDate,
      d.Name AS Department,
      (SELECT COUNT(*) FROM ProjectAssignments pa WHERE pa.ProjectID=p.ProjectID) AS TeamSize
      FROM Projects p JOIN Departments d ON d.DepartmentID=p.DepartmentID
      WHERE 1=1 ${where} ORDER BY ${orderBy}`;
    try {
      const data = await execQuery(sqlText);
      res.json({ type: 'projects', data, generatedSQL: sqlText.replace(/\s+/g, ' ').trim(), query: nlQuery });
    } catch (e) { res.status(500).json({ error: e.message }); }
  }
});

// ─────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Company Analytics running at http://localhost:${PORT}`);
  console.log(`📊  Open your browser at http://localhost:${PORT}`);
  console.log(`🔌  Click "Connect DB" and enter your credentials\n`);
});