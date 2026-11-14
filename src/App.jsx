import { useEffect, useMemo, useRef, useState } from "react";

const navigation = [
  { label: "Dashboard", icon: "▦", page: "dashboard", group: "MAIN" },
  { label: "Students", icon: "♙", page: "students", group: "MAIN" },
  { label: "Registration", icon: "＋", page: "registration", group: "MAIN" },
  { label: "Courses", icon: "▤", page: "courses", group: "MAIN" },
  { label: "Attendance", icon: "◷", page: "attendance", group: "MAIN" },
  { label: "Grades", icon: "⌁", page: "grades", group: "MAIN" },
  { label: "Reports", icon: "▧", page: "reports", group: "SYSTEM" },
  { label: "Settings", icon: "⚙", page: "settings", group: "SYSTEM" }
];

const blankStudent = {
  id: "", name: "", email: "", phone: "", dateOfBirth: "", gender: "",
  department: "", year: "", semester: "Semester 1", enrollmentDate: "", address: ""
};

const pageTitles = {
  dashboard: "Dashboard",
  students: "Students",
  registration: "Student Registration",
  courses: "Courses",
  attendance: "Attendance",
  grades: "Grades",
  reports: "Reports",
  settings: "Settings"
};
const pageSize = 20;

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "The request could not be completed.");
  return payload;
}

function App() {
  const [students, setStudents] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [studentForm, setStudentForm] = useState(blankStudent);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [listPage, setListPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [chartMonths, setChartMonths] = useState(6);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [listError, setListError] = useState("");
  const [databaseStatus, setDatabaseStatus] = useState("Checking");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authState, setAuthState] = useState("checking");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const studentsRequest = useRef(0);

  async function checkSession() {
    setAuthState("checking");
    try {
      const session = await api("/auth/session");
      setAuthState(session.authenticated ? "authenticated" : "unauthenticated");
    } catch (error) {
      setLoginError(error.message);
      setAuthState("unavailable");
    }
  }

  useEffect(() => {
    let active = true;
    api("/auth/session").then((session) => {
      if (active) setAuthState(session.authenticated ? "authenticated" : "unauthenticated");
    }).catch((error) => {
      if (active) {
        setLoginError(error.message);
        setAuthState("unavailable");
      }
    });
    return () => { active = false; };
  }, []);

  async function loadDashboard() {
    setDashboardLoading(true);
    try {
      const result = await api("/dashboard");
      setDashboard(result);
      setDatabaseStatus("Connected");
    } catch (error) {
      setDatabaseStatus("Unavailable");
      setMessage(error.message);
    } finally {
      setDashboardLoading(false);
    }
  }

  async function loadStudents() {
    const requestId = ++studentsRequest.current;
    const params = new URLSearchParams({
      page: String(listPage),
      limit: String(pageSize),
      sort: sortBy
    });
    if (search.trim()) params.set("q", search.trim());
    if (department) params.set("department", department);
    if (year) params.set("year", year);
    if (statusFilter) params.set("status", statusFilter);

    setLoading(true);
    setListError("");
    try {
      const result = await api(`/students?${params}`);
      if (requestId !== studentsRequest.current) return;
      setStudents(result.items);
      setTotalRecords(result.total);
      if (result.page !== listPage) setListPage(result.page);
      setDatabaseStatus("Connected");
    } catch (error) {
      if (requestId === studentsRequest.current) {
        setListError(error.message);
        setDatabaseStatus("Unavailable");
      }
    } finally {
      if (requestId === studentsRequest.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (authState !== "authenticated") return;
    loadDashboard();
  }, [authState]);

  useEffect(() => {
    if (authState !== "authenticated" || page !== "students") return undefined;
    const timer = window.setTimeout(() => { loadStudents(); }, 250);
    return () => window.clearTimeout(timer);
  }, [authState, page, search, department, year, statusFilter, sortBy, listPage]);

  const title = page === "registration" && editingId ? "Edit Student" : pageTitles[page];
  const departments = dashboard?.departments || [];
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const monthSeries = useMemo(() => {
    const totals = new Map((dashboard?.monthlyRegistrations || []).map(item => [item.month, item.total]));
    return Array.from({ length: chartMonths }, (_, index) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - chartMonths + index + 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return {
        key,
        label: date.toLocaleString(undefined, { month: "short" }),
        total: totals.get(key) || 0
      };
    });
  }, [chartMonths, dashboard]);
  const highestMonthlyTotal = Math.max(1, ...monthSeries.map(item => item.total));
  const highestDepartmentTotal = Math.max(1, ...departments.map(item => item.total));

  function navigate(nextPage) {
    setPage(nextPage);
    setSidebarOpen(false);
    setMessage("");
  }

  function startRegistration() {
    setStudentForm(blankStudent);
    setEditingId(null);
    navigate("registration");
  }

  function editStudent(student) {
    setStudentForm({
      ...blankStudent,
      ...student,
      dateOfBirth: student.dateOfBirth?.slice(0, 10) || "",
      enrollmentDate: student.enrollmentDate?.slice(0, 10) || ""
    });
    setEditingId(student.id);
    navigate("registration");
  }

  async function saveStudent(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const path = editingId ? `/students/${encodeURIComponent(editingId)}` : "/students";
      const result = await api(path, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(studentForm)
      });
      setStudentForm(blankStudent);
      setEditingId(null);
      setSearch("");
      setDepartment("");
      setYear("");
      setStatusFilter("");
      setSortBy("newest");
      setListPage(1);
      setPage("students");
      setMessage(result.message);
      await loadDashboard();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteStudent(student) {
    if (!window.confirm(`Delete ${student.name}'s student record?`)) return;
    try {
      const result = await api(`/students/${encodeURIComponent(student.id)}`, { method: "DELETE" });
      setMessage(result.message);
      await Promise.all([loadDashboard(), loadStudents()]);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function exportStudents(includeFilters = true) {
    const params = new URLSearchParams();
    if (includeFilters) {
      if (search.trim()) params.set("q", search.trim());
      if (department) params.set("department", department);
      if (year) params.set("year", year);
      if (statusFilter) params.set("status", statusFilter);
    }
    params.set("sort", includeFilters ? sortBy : "newest");
    try {
      const response = await fetch(`/api/students/export.csv?${params}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Unable to export student records.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `student-register-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setMessage("Student report downloaded.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitLogin(event) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    try {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm)
      });
      setLoginForm({ username: "", password: "" });
      setAuthState("authenticated");
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setLoginBusy(false);
    }
  }

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setAuthState("unauthenticated");
      setDashboard(null);
      setStudents([]);
      setMessage("");
      setLoginError("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function updateField(event) {
    setStudentForm(current => ({ ...current, [event.target.name]: event.target.value }));
  }

  if (authState !== "authenticated") {
    return <LoginScreen
      state={authState}
      error={loginError}
      busy={loginBusy}
      form={loginForm}
      onChange={event => setLoginForm(current => ({ ...current, [event.target.name]: event.target.value }))}
      onSubmit={submitLogin}
      onRetry={checkSession}
    />;
  }

  return <>
    <aside className={`sidebar ${sidebarOpen ? "show" : ""}`}>
      <div className="logo"><div className="logo-icon">E</div><div><h2>EduManage</h2><span>Student System</span></div></div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {["MAIN", "SYSTEM"].map(group => <div key={group}>
          <p className="nav-title">{group}</p>
          {navigation.filter(item => item.group === group).map(item =>
            <button
              className={`nav-link ${page === item.page ? "active" : ""}`}
              key={item.page}
              onClick={() => navigate(item.page)}
              type="button"
              aria-current={page === item.page ? "page" : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>{item.label}
            </button>
          )}
        </div>)}
      </nav>
      <div className="sidebar-footer">
        <div className="admin-avatar">A</div>
        <div><strong>Administrator</strong><small>System Admin</small></div>
      </div>
    </aside>

    {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} type="button" />}

    <main className="main-content">
      <header className="top-header">
        <div className="header-title">
          <button className="menu-button" onClick={() => setSidebarOpen(!sidebarOpen)} type="button" aria-label="Toggle navigation">☰</button>
          <div><p className="eyebrow">EDUMANAGE <span>/</span> ACADEMIC ADMINISTRATION</p><h1>{title}</h1></div>
        </div>
        <div className="header-actions">
          <span className={`connection-pill ${databaseStatus === "Connected" ? "online" : ""}`}><i />Database {databaseStatus.toLowerCase()}</span>
          <div className="profile"><div className="profile-avatar">A</div><div><strong>Administrator</strong><small>Admin</small></div></div>
          <button className="logout-button" onClick={logout} type="button">Sign out</button>
        </div>
      </header>

      {message && <div className="notice" role="status" aria-live="polite"><span>{message}</span><button type="button" aria-label="Dismiss message" onClick={() => setMessage("")}>×</button></div>}

      {page === "dashboard" && <section className="page-section">
        <div className="section-heading">
          <div><p className="eyebrow">OVERVIEW</p><h2>Academic overview</h2><p>A live view of student registrations and enrollment.</p></div>
          <button className="primary-button" onClick={startRegistration} type="button"><span>＋</span> Add student</button>
        </div>

        <div className="stats-grid">
          <Stat icon="♙" tone="blue" label="Total students" value={dashboardLoading ? "—" : dashboard?.stats.totalStudents ?? 0} foot="In the student register" />
          <Stat icon="✓" tone="green" label="Active students" value={dashboardLoading ? "—" : dashboard?.stats.activeStudents ?? 0} foot="Currently active records" />
          <Stat icon="▤" tone="purple" label="Departments" value={dashboardLoading ? "—" : dashboard?.stats.totalDepartments ?? 0} foot="With enrolled students" />
          <Stat icon="◷" tone="orange" label="Data source" value={databaseStatus} foot="Live MySQL connection" />
        </div>

        <div className="analytics-grid">
          <article className="dashboard-card chart-card">
            <div className="card-header chart-heading">
              <div><h3>Registration activity</h3><p>New student records created each month.</p></div>
              <label className="chart-period"><span className="sr-only">Chart period</span>
                <select value={chartMonths} onChange={event => setChartMonths(Number(event.target.value))} aria-label="Registration chart period">
                  <option value="6">Last 6 months</option><option value="12">Last 12 months</option>
                </select>
              </label>
            </div>
            {dashboardLoading ? <div className="chart-placeholder" role="status">Loading registration activity…</div>
              : <div className="bar-chart" role="img" aria-label={`Monthly registrations over the last ${chartMonths} months`}>
                {monthSeries.map(item => <div className="bar-column" key={item.key} title={`${item.label}: ${item.total} registrations`}>
                  <strong>{item.total || ""}</strong>
                  <div className="bar-track"><span style={{ height: `${item.total ? Math.max(8, item.total / highestMonthlyTotal * 100) : 0}%` }} /></div>
                  <small>{item.label}</small>
                </div>)}
              </div>}
          </article>

          <article className="dashboard-card chart-card department-card">
            <div className="card-header"><div><h3>Students by department</h3><p>Enrollment across active departments.</p></div></div>
            {dashboardLoading ? <div className="chart-placeholder" role="status">Loading departments…</div>
              : departments.length === 0 ? <EmptyState title="No department data" description="Department analytics will appear when students are registered." />
                : <div className="department-bars">
                  {departments.map(item => <button
                    className="department-bar-row"
                    key={item.name}
                    onClick={() => { setDepartment(item.name); setListPage(1); navigate("students"); }}
                    type="button"
                    title={`View ${item.name} students`}
                  >
                    <span className="department-bar-label">{item.name}</span>
                    <span className="department-bar-track"><span style={{ width: `${item.total / highestDepartmentTotal * 100}%` }} /></span>
                    <strong>{item.total}</strong>
                  </button>)}
                </div>}
          </article>
        </div>

        <div className="dashboard-grid">
          <article className="dashboard-card">
            <div className="card-header card-header-row"><div><h3>Recently registered</h3><p>Latest records from the student register.</p></div><button className="text-button" onClick={() => navigate("students")} type="button">View directory →</button></div>
            {!dashboardLoading && (dashboard?.recentStudents.length || 0) === 0
              ? <EmptyState loading={dashboardLoading} onAdd={startRegistration} />
              : <div className="recent-list">{(dashboard?.recentStudents || []).map(student =>
                <div className="recent-row" key={student.id}>
                  <div className="student-avatar">{student.name?.charAt(0).toUpperCase()}</div>
                  <div className="recent-name"><strong>{student.name}</strong><small>{student.id} · {student.department}</small></div>
                  <StatusBadge status={student.status} />
                </div>
              )}</div>}
          </article>
          <article className="dashboard-card system-card">
            <div className="card-header"><div><h3>System status</h3><p>Current service health.</p></div></div>
            <div className="system-info">
              <div className="info-row"><span>API</span><strong className="status-online">● Online</strong></div>
              <div className="info-row"><span>MySQL</span><strong>{databaseStatus}</strong></div>
              <div className="info-row"><span>Active records</span><strong>{dashboardLoading ? "—" : dashboard?.stats.activeStudents ?? 0}</strong></div>
              <div className="info-row"><span>Administrator access</span><strong className="status-online">Protected</strong></div>
            </div>
          </article>
        </div>
      </section>}

      {page === "students" && <section className="page-section">
        <div className="section-heading">
          <div><p className="eyebrow">STUDENT RECORDS</p><h2>Student directory</h2><p>Search, filter, and manage the live student register.</p></div>
          <div className="heading-actions"><button className="secondary-button" onClick={() => exportStudents(true)} type="button">↓ Export CSV</button><button className="primary-button" onClick={startRegistration} type="button"><span>＋</span> Add student</button></div>
        </div>
        <div className="table-card">
          <div className="table-toolbar">
            <label className="search-box"><span aria-hidden="true">⌕</span><input value={search} onChange={event => { setSearch(event.target.value); setListPage(1); }} placeholder="Search name, ID, email or phone" aria-label="Search students" /></label>
            <div className="table-filters">
              <select aria-label="Filter by department" value={department} onChange={event => { setDepartment(event.target.value); setListPage(1); }}>
                <option value="">All departments</option>{departments.map(item => <option value={item.name} key={item.name}>{item.name}</option>)}
              </select>
              <select aria-label="Filter by year" value={year} onChange={event => { setYear(event.target.value); setListPage(1); }}>
                <option value="">All years</option>{["1st Year", "2nd Year", "3rd Year", "4th Year"].map(item => <option key={item}>{item}</option>)}
              </select>
              <select aria-label="Filter by status" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setListPage(1); }}>
                <option value="">All statuses</option>{["Active", "Inactive", "Graduated"].map(item => <option key={item}>{item}</option>)}
              </select>
              <select aria-label="Sort students" value={sortBy} onChange={event => { setSortBy(event.target.value); setListPage(1); }}>
                <option value="name">Name A–Z</option><option value="newest">Recently added</option><option value="id">Student ID</option><option value="department">Department</option><option value="year">Study year</option>
              </select>
            </div>
          </div>
          <div className="table-container"><table>
            <thead><tr><th>Student ID</th><th>Student</th><th>Email</th><th>Department</th><th>Year</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="7" className="table-message">Loading student records…</td></tr>
                : listError ? <tr><td colSpan="7"><EmptyState title="Couldn't load student records" description={listError} /></td></tr>
                  : students.length === 0 ? <tr><td colSpan="7"><EmptyState hasRecords={totalRecords > 0} onAdd={startRegistration} /></td></tr>
                    : students.map(student => <tr key={student.id}>
                      <td><strong>{student.id}</strong></td>
                      <td><div className="table-student"><div className="student-avatar">{student.name?.charAt(0).toUpperCase()}</div><strong>{student.name}</strong></div></td>
                      <td>{student.email}</td><td>{student.department}</td><td>{student.year}</td><td><StatusBadge status={student.status} /></td>
                      <td><div className="row-actions"><button className="secondary-button" onClick={() => editStudent(student)} type="button">Edit</button><button className="danger-button" onClick={() => deleteStudent(student)} type="button">Delete</button></div></td>
                    </tr>)}
            </tbody>
          </table></div>
          <div className="table-pagination">
            <span>{totalRecords === 0 ? "No records" : `Showing ${(listPage - 1) * pageSize + 1}–${Math.min(listPage * pageSize, totalRecords)} of ${totalRecords}`}</span>
            <div><button className="secondary-button" disabled={listPage <= 1 || loading} onClick={() => setListPage(current => current - 1)} type="button">Previous</button><span>Page {listPage} of {totalPages}</span><button className="secondary-button" disabled={listPage >= totalPages || loading} onClick={() => setListPage(current => current + 1)} type="button">Next</button></div>
          </div>
        </div>
      </section>}

      {page === "registration" && <section className="page-section">
        <div className="section-heading"><div><p className="eyebrow">STUDENT RECORDS</p><h2>{editingId ? "Update student record" : "Register a student"}</h2><p>Student information is validated and saved to the database.</p></div></div>
        <form className="form-card" onSubmit={saveStudent}>
          <FormGroup title="Personal information" description="Basic identity and contact details.">
            <Field label="Student ID" name="id" value={studentForm.id} onChange={updateField} required disabled={Boolean(editingId)} maxLength="40" placeholder="e.g. STU-2026-001" />
            <Field label="Full name" name="name" value={studentForm.name} onChange={updateField} required maxLength="160" autoComplete="name" placeholder="Enter full name" />
            <Field label="Email address" name="email" type="email" value={studentForm.email} onChange={updateField} required maxLength="254" autoComplete="email" placeholder="student@example.com" />
            <Field label="Phone number" name="phone" type="tel" value={studentForm.phone} onChange={updateField} maxLength="40" autoComplete="tel" placeholder="+1 555 000 0000" />
            <Field label="Date of birth" name="dateOfBirth" type="date" value={studentForm.dateOfBirth} onChange={updateField} />
            <SelectField label="Gender" name="gender" value={studentForm.gender} onChange={updateField} options={[["", "Select gender"], ["Female", "Female"], ["Male", "Male"], ["Other", "Other"]]} />
          </FormGroup>
          <FormGroup title="Academic information" description="Department and enrollment details.">
            <SelectField label="Department" name="department" value={studentForm.department} onChange={updateField} required options={[["", "Select department"], ...["Computer Science", "Software Engineering", "Information Technology", "Business", "Accounting"].map(item => [item, item])]} />
            <SelectField label="Year" name="year" value={studentForm.year} onChange={updateField} required options={[["", "Select year"], ...["1st Year", "2nd Year", "3rd Year", "4th Year"].map(item => [item, item])]} />
            <SelectField label="Semester" name="semester" value={studentForm.semester} onChange={updateField} options={[["Semester 1", "Semester 1"], ["Semester 2", "Semester 2"]]} />
            <Field label="Enrollment date" name="enrollmentDate" type="date" value={studentForm.enrollmentDate} onChange={updateField} />
            <label className="form-group full-width"><span>Address</span><textarea name="address" rows="3" maxLength="5000" value={studentForm.address} onChange={updateField} placeholder="Enter the student's address" /></label>
          </FormGroup>
          <div className="form-actions"><button className="secondary-button" onClick={() => navigate("students")} type="button">Cancel</button><button className="primary-button" disabled={busy} type="submit">{busy ? "Saving…" : editingId ? "Save changes" : "Register student"}</button></div>
        </form>
      </section>}

      {page === "reports" && <section className="page-section">
        <div className="section-heading"><div><p className="eyebrow">DATA & EXPORTS</p><h2>Reports</h2><p>Download a clean CSV export of the complete student register.</p></div><button className="primary-button" onClick={() => exportStudents(false)} type="button">↓ Export full register</button></div>
        <div className="stats-grid">
          <Stat icon="♙" tone="blue" label="Student records" value={dashboardLoading ? "—" : dashboard?.stats.totalStudents ?? 0} foot="Included in full export" />
          <Stat icon="✓" tone="green" label="Active students" value={dashboardLoading ? "—" : dashboard?.stats.activeStudents ?? 0} foot="Currently active records" />
          <Stat icon="▤" tone="purple" label="Departments" value={dashboardLoading ? "—" : dashboard?.stats.totalDepartments ?? 0} foot="Represented in the register" />
          <Stat icon="↓" tone="orange" label="Export format" value="CSV" foot="Excel and Sheets compatible" />
        </div>
        <article className="dashboard-card report-card"><div className="report-icon">↓</div><div><h3>Student register export</h3><p>Includes student IDs, contact details, department, year, enrollment information, address, and status. Spreadsheet formula-like values are safely escaped.</p><button className="secondary-button" onClick={() => exportStudents(false)} type="button">Download CSV</button></div></article>
      </section>}

      {page === "settings" && <section className="page-section">
        <div className="section-heading"><div><p className="eyebrow">SYSTEM</p><h2>Settings</h2><p>Administrator access and service status.</p></div></div>
        <article className="dashboard-card settings-card">
          <div className="card-header"><div><h3>Administrator account</h3><p>Sign-in credentials are managed securely through the deployment environment.</p></div></div>
          <div className="system-info">
            <div className="info-row"><span>Signed in as</span><strong>Administrator</strong></div>
            <div className="info-row"><span>Session security</span><strong className="status-online">HttpOnly secure cookie</strong></div>
            <div className="info-row"><span>Database connection</span><strong>{databaseStatus}</strong></div>
          </div>
          <button className="secondary-button" onClick={logout} type="button">Sign out</button>
        </article>
      </section>}

      {["courses", "attendance", "grades"].includes(page) && <section className="page-section">
        <div className="section-heading"><div><p className="eyebrow">ACADEMIC MODULE</p><h2>{pageTitles[page]}</h2><p>Academic administration</p></div></div>
        <div className="dashboard-card"><EmptyState title={`${pageTitles[page]} data is not configured`} description="This project currently stores student records only. Connect a course, attendance, or grade data model to enable this module; no sample records are shown as live data." /></div>
      </section>}

      <footer className="footer"><span>EduManage Student System</span><span>React · Express · MySQL</span></footer>
    </main>
  </>;
}

function LoginScreen({ state, error, busy, form, onChange, onSubmit, onRetry }) {
  return <main className="login-shell">
    <section className="login-card">
      <div className="login-brand"><span className="logo-icon">E</span><div><strong>EduManage</strong><small>Student System</small></div></div>
      <p className="eyebrow">ACADEMIC ADMINISTRATION</p>
      <h1>{state === "checking" ? "Checking access…" : state === "unavailable" ? "Service unavailable" : "Welcome back"}</h1>
      <p className="login-description">{state === "unavailable" ? "The application server could not be reached. Check the connection and try again." : "Sign in with your administrator account to continue."}</p>
      {error && <div className="login-error" role="alert">{error}</div>}
      {state === "unavailable" ? <button className="primary-button login-submit" onClick={onRetry} type="button">Retry connection</button>
        : <form onSubmit={onSubmit}>
          <label className="form-group"><span>Administrator username</span><input name="username" value={form.username} onChange={onChange} autoComplete="username" required disabled={state === "checking"} /></label>
          <label className="form-group"><span>Password</span><input name="password" type="password" value={form.password} onChange={onChange} autoComplete="current-password" required disabled={state === "checking"} /></label>
          <button className="primary-button login-submit" disabled={busy || state === "checking"} type="submit">{busy ? "Signing in…" : state === "checking" ? "Checking…" : "Sign in securely"}</button>
        </form>}
      <div className="login-security"><span>●</span> Administrator-only access</div>
    </section>
  </main>;
}

function Stat({ icon, tone, label, value, foot }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div><span>{label}</span><h3>{value}</h3><small>{foot}</small></div></div>;
}

function StatusBadge({ status }) {
  const normalized = (status || "Active").toLowerCase();
  return <span className={`status-badge ${normalized === "active" ? "status-active" : "status-inactive"}`}>{status || "Active"}</span>;
}

function EmptyState({ loading = false, hasRecords = false, onAdd, title, description }) {
  const heading = title || (loading ? "Loading records" : hasRecords ? "No matching students" : "No students yet");
  const detail = description || (loading ? "Connecting to the student database." : hasRecords ? "Try changing your search or filters." : "Register the first student to start your directory.");
  return <div className="empty-state"><div className="empty-icon">♙</div><h3>{heading}</h3><p>{detail}</p>{!loading && !hasRecords && onAdd && <button className="primary-button" onClick={onAdd} type="button">Register student</button>}</div>;
}

function FormGroup({ title, description, children }) {
  return <div className="form-section"><div className="form-section-title"><h3>{title}</h3><p>{description}</p></div><div className="form-grid">{children}</div></div>;
}

function Field({ label, name, type = "text", ...props }) {
  return <label className="form-group"><span>{label}</span><input name={name} type={type} {...props} /></label>;
}

function SelectField({ label, name, options, ...props }) {
  return <label className="form-group"><span>{label}</span><select name={name} {...props}>{options.map(([value, text]) => <option value={value} key={value || "empty"}>{text}</option>)}</select></label>;
}

export default App;
