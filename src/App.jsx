import { useEffect, useState } from "react";

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

const courses = [
  ["Web Development", "HTML, CSS, JavaScript and modern web development.", "4 Credits", "45 Students", "⌘"],
  ["Data Structures", "Algorithms, data structures and problem solving.", "3 Credits", "38 Students", "⌗"],
  ["Database Systems", "SQL, database design and data management.", "3 Credits", "42 Students", "▤"],
  ["Artificial Intelligence", "Introduction to AI and intelligent systems.", "4 Credits", "31 Students", "✳"]
];

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
  const [page, setPage] = useState("dashboard");
  const [studentForm, setStudentForm] = useState(blankStudent);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [databaseStatus, setDatabaseStatus] = useState("Checking");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function loadStudents() {
    setLoading(true);
    try {
      const records = await api("/students");
      setStudents(records);
      setDatabaseStatus("Connected");
      setMessage("");
    } catch (error) {
      setDatabaseStatus("Unavailable");
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStudents(); }, []);

  const filteredStudents = students.filter((student) => {
    const query = search.trim().toLowerCase();
    const matchesQuery = !query || [student.id, student.name, student.email]
      .some((value) => value?.toLowerCase().includes(query));
    return matchesQuery && (!department || student.department === department);
  });

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
      await loadStudents();
      setStudentForm(blankStudent);
      setEditingId(null);
      setPage("students");
      setMessage(result.message);
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
      await loadStudents();
      setMessage(result.message);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function updateField(event) {
    setStudentForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  const pageTitles = {
    dashboard: "Dashboard", students: "Students",
    registration: editingId ? "Edit Student" : "Student Registration",
    courses: "Courses", attendance: "Attendance", grades: "Grades", reports: "Reports", settings: "Settings"
  };

  return <>
    <aside className={`sidebar ${sidebarOpen ? "show" : ""}`}>
      <div className="logo"><div className="logo-icon">E</div><div><h2>EduManage</h2><span>Student System</span></div></div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {["MAIN", "SYSTEM"].map((group) => <div key={group}><p className="nav-title">{group}</p>
          {navigation.filter((item) => item.group === group).map((item) => <button className={`nav-link ${page === item.page ? "active" : ""}`} key={item.page} onClick={() => navigate(item.page)} type="button"><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}
        </div>)}
      </nav>
      <div className="sidebar-footer"><div className="admin-avatar">A</div><div><strong>Administrator</strong><small>System Admin</small></div></div>
    </aside>

    <main className="main-content">
      <header className="top-header">
        <div className="header-title"><button className="menu-button" onClick={() => setSidebarOpen(!sidebarOpen)} type="button" aria-label="Toggle navigation">☰</button><div><p className="eyebrow">EDUMANAGE / ACADEMIC ADMINISTRATION</p><h1>{pageTitles[page]}</h1></div></div>
        <div className="header-actions"><span className={`connection-pill ${databaseStatus === "Connected" ? "online" : ""}`}><i />Database {databaseStatus.toLowerCase()}</span><div className="profile"><div className="profile-avatar">A</div><div><strong>Administrator</strong><small>Admin</small></div></div></div>
      </header>
      {message && <div className="notice" role="status"><span>{message}</span><button type="button" aria-label="Dismiss message" onClick={() => setMessage("")}>×</button></div>}

      {page === "dashboard" && <section className="page-section">
        <div className="section-heading"><div><h2>Academic overview</h2><p>A live view of the student register.</p></div><button className="primary-button" onClick={startRegistration} type="button"><span>＋</span> Add Student</button></div>
        <div className="stats-grid"><Stat icon="♙" tone="blue" label="Total Students" value={loading ? "..." : students.length} foot="Registered records" /><Stat icon="▤" tone="green" label="Departments" value={new Set(students.map((student) => student.department)).size} foot="With enrolled students" /><Stat icon="◷" tone="orange" label="Academic Year" value="2026 / 27" foot="Current academic year" /><Stat icon="✓" tone="purple" label="Database" value={databaseStatus} foot="MySQL connection" /></div>
        <div className="dashboard-grid">
          <div className="dashboard-card"><div className="card-header"><div><h3>Recently registered</h3><p>Latest records from MySQL.</p></div><button className="text-button" onClick={() => navigate("students")} type="button">All students →</button></div>
            {students.length === 0 ? <EmptyState loading={loading} onAdd={startRegistration} /> : <div className="recent-list">{students.slice(0, 5).map((student) => <div className="recent-row" key={student.id}><div className="student-avatar">{student.name?.charAt(0).toUpperCase()}</div><div className="recent-name"><strong>{student.name}</strong><small>{student.id} · {student.department}</small></div><span className="status-badge">{student.status || "Active"}</span></div>)}</div>}
          </div>
          <div className="dashboard-card system-card"><div className="card-header"><div><h3>System information</h3><p>Current service status.</p></div></div><div className="system-info"><div className="info-row"><span>API</span><strong className="status-online">● Online</strong></div><div className="info-row"><span>MySQL</span><strong>{databaseStatus}</strong></div><div className="info-row"><span>Academic year</span><strong>2026 / 2027</strong></div><div className="info-row"><span>Semester</span><strong>Semester 1</strong></div></div></div>
        </div>
      </section>}

      {page === "students" && <section className="page-section">
        <div className="section-heading"><div><h2>Student directory</h2><p>{students.length} records in the register.</p></div><button className="primary-button" onClick={startRegistration} type="button"><span>＋</span> Add Student</button></div>
        <div className="table-card"><div className="table-toolbar"><label className="search-box"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, ID or email" aria-label="Search students" /></label><select aria-label="Filter by department" value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">All Departments</option>{[...new Set(students.map((student) => student.department))].sort().map((name) => <option key={name}>{name}</option>)}</select></div>
          <div className="table-container"><table><thead><tr><th>Student ID</th><th>Student</th><th>Email</th><th>Department</th><th>Year</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {loading ? <tr><td colSpan="7" className="table-message">Loading student records…</td></tr> : filteredStudents.length === 0 ? <tr><td colSpan="7"><EmptyState onAdd={startRegistration} hasRecords={students.length > 0} /></td></tr> : filteredStudents.map((student) => <tr key={student.id}><td><strong>{student.id}</strong></td><td><div className="table-student"><div className="student-avatar">{student.name?.charAt(0).toUpperCase()}</div><strong>{student.name}</strong></div></td><td>{student.email}</td><td>{student.department}</td><td>{student.year}</td><td><span className="status-badge">{student.status || "Active"}</span></td><td><div className="row-actions"><button className="secondary-button" onClick={() => editStudent(student)} type="button">Edit</button><button className="danger-button" onClick={() => deleteStudent(student)} type="button">Delete</button></div></td></tr>)}
          </tbody></table></div>
        </div>
      </section>}

      {page === "registration" && <section className="page-section">
        <div className="section-heading"><div><h2>{editingId ? "Update student record" : "Register a student"}</h2><p>Student information is saved directly to the MySQL database.</p></div></div>
        <form className="form-card" onSubmit={saveStudent}>
          <FormGroup title="Personal information" description="Basic identity and contact details.">
            <Field label="Student ID" name="id" value={studentForm.id} onChange={updateField} required disabled={Boolean(editingId)} placeholder="e.g. STU-2026-001" />
            <Field label="Full name" name="name" value={studentForm.name} onChange={updateField} required placeholder="Enter full name" />
            <Field label="Email address" name="email" type="email" value={studentForm.email} onChange={updateField} required placeholder="student@example.com" />
            <Field label="Phone number" name="phone" type="tel" value={studentForm.phone} onChange={updateField} placeholder="+1 555 000 0000" />
            <Field label="Date of birth" name="dateOfBirth" type="date" value={studentForm.dateOfBirth} onChange={updateField} />
            <SelectField label="Gender" name="gender" value={studentForm.gender} onChange={updateField} options={[["", "Select gender"], ["Female", "Female"], ["Male", "Male"], ["Other", "Other"]]} />
          </FormGroup>
          <FormGroup title="Academic information" description="Department and enrollment details.">
            <SelectField label="Department" name="department" value={studentForm.department} onChange={updateField} required options={[["", "Select department"], ...["Computer Science", "Software Engineering", "Information Technology", "Business", "Accounting"].map((item) => [item, item])]} />
            <SelectField label="Year" name="year" value={studentForm.year} onChange={updateField} required options={[["", "Select year"], ...["1st Year", "2nd Year", "3rd Year", "4th Year"].map((item) => [item, item])]} />
            <SelectField label="Semester" name="semester" value={studentForm.semester} onChange={updateField} options={[["Semester 1", "Semester 1"], ["Semester 2", "Semester 2"]]} />
            <Field label="Enrollment date" name="enrollmentDate" type="date" value={studentForm.enrollmentDate} onChange={updateField} />
            <label className="form-group full-width"><span>Address</span><textarea name="address" rows="3" value={studentForm.address} onChange={updateField} placeholder="Enter the student's address" /></label>
          </FormGroup>
          <div className="form-actions"><button className="secondary-button" onClick={() => navigate("students")} type="button">Cancel</button><button className="primary-button" disabled={busy} type="submit">{busy ? "Saving…" : editingId ? "Save Changes" : "Register Student"}</button></div>
        </form>
      </section>}

      {page === "courses" && <section className="page-section"><div className="section-heading"><div><h2>Courses</h2><p>Current course catalogue.</p></div></div><div className="course-grid">{courses.map(([name, description, credits, enrolled, icon]) => <article className="course-card" key={name}><div className="course-icon">{icon}</div><h3>{name}</h3><p>{description}</p><div className="course-info"><span>{credits}</span><span>{enrolled}</span></div></article>)}</div></section>}
      {["attendance", "grades", "reports", "settings"].includes(page) && <section className="page-section"><div className="section-heading"><div><h2>{pageTitles[page]}</h2><p>Academic administration</p></div></div><div className="dashboard-card"><EmptyState title={`${pageTitles[page]} records`} description="This area is ready for the next part of the academic system." /></div></section>}

      <footer className="footer"><span>EduManage Student System</span><span>React · Node.js · MySQL</span></footer>
    </main>
  </>;
}

function Stat({ icon, tone, label, value, foot }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div><span>{label}</span><h3>{value}</h3><small>{foot}</small></div></div>;
}

function EmptyState({ loading = false, hasRecords = false, onAdd, title, description }) {
  const heading = title || (loading ? "Loading records" : hasRecords ? "No matching students" : "No students yet");
  const detail = description || (loading ? "Connecting to the student database." : hasRecords ? "Try changing your search or department filter." : "Register the first student to start your directory.");
  return <div className="empty-state"><div className="empty-icon">♙</div><h3>{heading}</h3><p>{detail}</p>{!loading && !hasRecords && onAdd && <button className="primary-button" onClick={onAdd} type="button">Register Student</button>}</div>;
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