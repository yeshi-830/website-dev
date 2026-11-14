const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const isProduction = process.env.NODE_ENV === "production";
const sessionCookie = "edumanage_session";
const sessionDuration = 8 * 60 * 60 * 1000;
const allowedOrigins = new Set(
    (process.env.CORS_ORIGIN || (isProduction ? "" : "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173"))
        .split(",")
        .map(origin => origin.trim())
        .filter(Boolean)
);

const authConfiguration = {
    username: process.env.ADMIN_USERNAME || "",
    password: process.env.ADMIN_PASSWORD || "",
    sessionSecret: process.env.SESSION_SECRET || ""
};
const hasAuthConfiguration = Object.values(authConfiguration).some(Boolean);
const authEnabled = Object.values(authConfiguration).every(Boolean);

if (hasAuthConfiguration && !authEnabled) {
    throw new Error("Set ADMIN_USERNAME, ADMIN_PASSWORD, and SESSION_SECRET together.");
}
if (authEnabled && authConfiguration.sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
}
if (authEnabled && authConfiguration.password.length < 12) {
    throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
}
if (isProduction && !authEnabled) {
    throw new Error("Configure ADMIN_USERNAME, ADMIN_PASSWORD, and SESSION_SECRET before production startup.");
}

app.disable("x-powered-by");
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
});

function isTrustedOrigin(req, origin) {
    if (!origin) return true;
    if (allowedOrigins.has(origin)) return true;

    try {
        const parsedOrigin = new URL(origin);
        return (parsedOrigin.protocol === "http:" || parsedOrigin.protocol === "https:")
            && parsedOrigin.origin === origin
            && parsedOrigin.host === req.get("host");
    } catch {
        return false;
    }
}

app.use((req, res, next) => {
    const origin = req.get("Origin");
    if (!isTrustedOrigin(req, origin)) {
        return res.status(403).json({ message: "This origin is not allowed." });
    }
    return cors({
        origin: origin || false,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type"]
    })(req, res, next);
});
app.use(express.json({ limit: "32kb" }));

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60000,
    enableKeepAlive: true,
    dateStrings: true
});

function readCookie(req, name) {
    const cookies = req.headers.cookie || "";
    const entry = cookies.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`));
    return entry ? entry.slice(name.length + 1) : "";
}

function signSession(payload) {
    return crypto.createHmac("sha256", authConfiguration.sessionSecret).update(payload).digest("base64url");
}

function readSession(req) {
    if (!authEnabled) return { username: "Administrator" };

    const [payload, signature, extra] = readCookie(req, sessionCookie).split(".");
    if (!payload || !signature || extra) return null;

    const expected = Buffer.from(signSession(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;

    try {
        const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        if (session.username !== authConfiguration.username || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
            return null;
        }
        return session;
    } catch {
        return null;
    }
}

function setSessionCookie(res) {
    const payload = Buffer.from(JSON.stringify({
        username: authConfiguration.username,
        expiresAt: Date.now() + sessionDuration
    })).toString("base64url");
    const value = `${payload}.${signSession(payload)}`;
    const attributes = [
        `${sessionCookie}=${value}`,
        "HttpOnly",
        "SameSite=Lax",
        "Path=/",
        `Max-Age=${Math.floor(sessionDuration / 1000)}`
    ];
    if (isProduction) attributes.push("Secure");
    res.setHeader("Set-Cookie", attributes.join("; "));
}

const loginAttempts = new Map();
const loginWindow = 15 * 60 * 1000;
const loginLimit = 8;
const cleanupLoginAttempts = setInterval(() => {
    const now = Date.now();
    for (const [address, entry] of loginAttempts) {
        if (entry.resetAt <= now) loginAttempts.delete(address);
    }
}, 60 * 1000);
cleanupLoginAttempts.unref();

function allowLoginAttempt(req, res, next) {
    const address = req.socket.remoteAddress || "unknown";
    const now = Date.now();
    let entry = loginAttempts.get(address);

    if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + loginWindow };
        loginAttempts.set(address, entry);
    }
    if (entry.count >= loginLimit) {
        res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
        return res.status(429).json({ message: "Too many sign-in attempts. Try again later." });
    }
    entry.count += 1;
    return next();
}

app.get("/api/auth/session", (req, res) => {
    const session = readSession(req);
    res.json({
        authenticated: Boolean(session),
        authRequired: authEnabled,
        username: session ? session.username : null
    });
});

app.post("/api/auth/login", allowLoginAttempt, (req, res) => {
    if (!authEnabled) return res.json({ authenticated: true, username: "Administrator" });

    const { username, password } = req.body || {};
    if (typeof username !== "string" || typeof password !== "string") {
        return res.status(400).json({ message: "Enter your administrator username and password." });
    }

    const usernameMatches = crypto.createHash("sha256").update(username).digest();
    const expectedUsername = crypto.createHash("sha256").update(authConfiguration.username).digest();
    const passwordMatches = crypto.createHash("sha256").update(password).digest();
    const expectedPassword = crypto.createHash("sha256").update(authConfiguration.password).digest();
    if (!crypto.timingSafeEqual(usernameMatches, expectedUsername) || !crypto.timingSafeEqual(passwordMatches, expectedPassword)) {
        return res.status(401).json({ message: "The username or password is incorrect." });
    }

    loginAttempts.delete(req.socket.remoteAddress || "unknown");
    setSessionCookie(res);
    return res.json({ authenticated: true, username: authConfiguration.username });
});

app.post("/api/auth/logout", (req, res) => {
    const attributes = [`${sessionCookie}=`, "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
    if (isProduction) attributes.push("Secure");
    res.setHeader("Set-Cookie", attributes.join("; "));
    res.json({ authenticated: false });
});

function requireAuthentication(req, res, next) {
    const session = readSession(req);
    if (!session) return res.status(401).json({ message: "Sign in to continue." });
    req.adminSession = session;
    return next();
}

app.get("/", (req, res, next) => {
    if (isProduction && fs.existsSync(path.join(__dirname, "dist", "index.html"))) return next();
    return res.json({ message: "Student Management System API is running." });
});

app.get("/api/health", async (req, res) => {
    try {
        await db.query("SELECT 1");
        return res.json({ api: "ok", database: "connected" });
    } catch (error) {
        console.error("Database health check failed:", error.message);
        return res.status(503).json({ api: "ok", database: "unavailable" });
    }
});

app.use("/api/dashboard", requireAuthentication);
app.get("/api/dashboard", async (req, res) => {
    try {
        const [[stats]] = await db.query(`
            SELECT
                COUNT(*) AS totalStudents,
                COUNT(DISTINCT department) AS totalDepartments,
                COALESCE(SUM(status = 'Active'), 0) AS activeStudents
            FROM students
        `);
        const [departments] = await db.query(`
            SELECT department AS name, COUNT(*) AS total
            FROM students
            GROUP BY department
            ORDER BY total DESC, department
            LIMIT 8
        `);
        const [monthlyRegistrations] = await db.query(`
            SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS total
            FROM students
            WHERE created_at >= DATE_SUB(DATE_FORMAT(CURRENT_DATE, '%Y-%m-01'), INTERVAL 11 MONTH)
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month
        `);
        const [recentStudents] = await db.query(`
            SELECT student_id AS id, name, department, status
            FROM students
            ORDER BY created_at DESC, student_id DESC
            LIMIT 5
        `);
        return res.json({
            stats: {
                totalStudents: Number(stats.totalStudents),
                totalDepartments: Number(stats.totalDepartments),
                activeStudents: Number(stats.activeStudents)
            },
            departments: departments.map(row => ({ name: row.name, total: Number(row.total) })),
            monthlyRegistrations: monthlyRegistrations.map(row => ({ month: row.month, total: Number(row.total) })),
            recentStudents
        });
    } catch (error) {
        console.error("Failed to load dashboard:", error.message);
        return res.status(500).json({ message: "Failed to load dashboard data." });
    }
});

function getStudentFilters(query) {
    const clauses = [];
    const values = [];
    const search = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
    const department = typeof query.department === "string" ? query.department.trim().slice(0, 120) : "";
    const year = typeof query.year === "string" ? query.year.trim().slice(0, 30) : "";
    const status = typeof query.status === "string" ? query.status.trim().slice(0, 20) : "";

    if (search) {
        clauses.push("(student_id LIKE ? OR name LIKE ? OR email LIKE ? OR phone LIKE ?)");
        const pattern = `%${search}%`;
        values.push(pattern, pattern, pattern, pattern);
    }
    if (department) {
        clauses.push("department = ?");
        values.push(department);
    }
    if (year) {
        clauses.push("study_year = ?");
        values.push(year);
    }
    if (status) {
        clauses.push("status = ?");
        values.push(status);
    }
    return {
        sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
        values
    };
}

function getSortColumn(sort) {
    const columns = {
        name: "name, student_id",
        newest: "created_at DESC, student_id DESC",
        id: "student_id",
        department: "department, name",
        year: "study_year, name"
    };
    return columns[sort] || columns.name;
}

app.use("/api/students", requireAuthentication);

app.get("/api/students/export.csv", async (req, res) => {
    try {
        const filters = getStudentFilters(req.query);
        const order = getSortColumn(req.query.sort);
        const [students] = await db.query(`
            SELECT student_id, name, email, phone, date_of_birth, gender, department,
                study_year, semester, enrollment_date, address, status
            FROM students
            ${filters.sql}
            ORDER BY ${order}
        `, filters.values);

        const columns = [
            ["Student ID", "student_id"], ["Name", "name"], ["Email", "email"],
            ["Phone", "phone"], ["Date of birth", "date_of_birth"], ["Gender", "gender"],
            ["Department", "department"], ["Year", "study_year"], ["Semester", "semester"],
            ["Enrollment date", "enrollment_date"], ["Address", "address"], ["Status", "status"]
        ];
        const csvValue = value => {
            let text = value == null ? "" : String(value);
            if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
            return `"${text.replace(/"/g, '""')}"`;
        };
        const csv = [
            columns.map(([label]) => csvValue(label)).join(","),
            ...students.map(student => columns.map(([, key]) => csvValue(student[key])).join(","))
        ].join("\r\n");

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="student-register-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.setHeader("Cache-Control", "no-store");
        return res.send(`\uFEFF${csv}`);
    } catch (error) {
        console.error("Failed to export students:", error.message);
        return res.status(500).json({ message: "Failed to export student records." });
    }
});

app.get("/api/students", async (req, res) => {
    const supportsPagination = ["page", "limit", "q", "department", "year", "status", "sort"]
        .some(key => req.query[key] !== undefined);
    const filters = getStudentFilters(req.query);

    try {
        if (!supportsPagination) {
            const [students] = await db.query(`
                SELECT
                    student_id AS id,
                    name,
                    email,
                    phone,
                    date_of_birth AS dateOfBirth,
                    gender,
                    department,
                    study_year AS year,
                    semester,
                    enrollment_date AS enrollmentDate,
                    address,
                    status
                FROM students
                ORDER BY name, student_id
            `);
            return res.json(students);
        }

        const page = req.query.page === undefined ? 1 : Number(req.query.page);
        const pageSize = req.query.limit === undefined ? 25 : Number(req.query.limit);
        if (!Number.isSafeInteger(page) || page < 1 || page > 100000
            || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
            return res.status(400).json({ message: "Page must be positive and page size must be between 1 and 100." });
        }

        const [[count]] = await db.query(
            `SELECT COUNT(*) AS total FROM students ${filters.sql}`,
            filters.values
        );
        const total = Number(count.total);
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const currentPage = Math.min(page, totalPages);
        const [students] = await db.query(`
            SELECT
                student_id AS id,
                name,
                email,
                phone,
                date_of_birth AS dateOfBirth,
                gender,
                department,
                study_year AS year,
                semester,
                enrollment_date AS enrollmentDate,
                address,
                status
            FROM students
            ${filters.sql}
            ORDER BY ${getSortColumn(req.query.sort)}
            LIMIT ? OFFSET ?
        `, [...filters.values, pageSize, (currentPage - 1) * pageSize]);

        return res.json({ items: students, total, page: currentPage, pageSize, totalPages });
    } catch (error) {
        console.error("Failed to load students:", error.message);
        return res.status(500).json({ message: "Failed to load students." });
    }
});

function readStudent(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;

    const fields = ["id", "name", "email", "department", "year"];
    if (!fields.every(key => typeof body[key] === "string" && body[key].trim())) return null;

    const student = {
        id: body.id.trim(),
        name: body.name.trim(),
        email: body.email.trim(),
        phone: body.phone,
        dateOfBirth: body.dateOfBirth,
        gender: body.gender,
        department: body.department.trim(),
        year: body.year.trim(),
        semester: body.semester,
        enrollmentDate: body.enrollmentDate,
        address: body.address
    };
    const limits = { id: 40, name: 160, email: 254, department: 120, year: 30 };
    if (Object.entries(limits).some(([key, limit]) => student[key].length > limit)) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email)) return null;

    const optionalText = ["phone", "gender", "semester", "address"];
    const optionalLimits = { phone: 40, gender: 30, semester: 30, address: 5000 };
    for (const key of optionalText) {
        const value = student[key];
        if (value == null || value === "") {
            student[key] = null;
            continue;
        }
        if (typeof value !== "string" || value.trim().length > optionalLimits[key]) return null;
        student[key] = value.trim();
    }

    for (const key of ["dateOfBirth", "enrollmentDate"]) {
        const value = student[key];
        if (value == null || value === "") {
            student[key] = null;
            continue;
        }
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)
            || Number.isNaN(Date.parse(`${value}T00:00:00Z`))
            || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
            return null;
        }
    }

    return [
        student.id,
        student.name,
        student.email,
        student.phone,
        student.dateOfBirth,
        student.gender,
        student.department,
        student.year,
        student.semester,
        student.enrollmentDate,
        student.address
    ];
}

function handleDatabaseError(res, error, action) {
    console.error(`Failed to ${action} student:`, error.message);
    if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "A student with this ID or email already exists." });
    }
    return res.status(500).json({ message: `Failed to ${action} student.` });
}

const studentColumns = `
    name = ?,
    email = ?,
    phone = ?,
    date_of_birth = ?,
    gender = ?,
    department = ?,
    study_year = ?,
    semester = ?,
    enrollment_date = ?,
    address = ?
`;

app.post("/api/students", async (req, res) => {
    const student = readStudent(req.body);
    if (!student) {
        return res.status(400).json({ message: "Enter valid student ID, name, email, department, and year details." });
    }

    const sql = `
        INSERT INTO students
        (
            student_id,
            name,
            email,
            phone,
            date_of_birth,
            gender,
            department,
            study_year,
            semester,
            enrollment_date,
            address,
            status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
    `;

    try {
        await db.execute(sql, student);
        return res.status(201).json({ message: "Student registered successfully." });
    } catch (error) {
        return handleDatabaseError(res, error, "register");
    }
});

app.put("/api/students/:id", async (req, res) => {
    const student = readStudent({ ...req.body, id: req.params.id });
    if (!student) {
        return res.status(400).json({ message: "Enter valid name, email, department, and year details." });
    }

    try {
        const [result] = await db.execute(
            `UPDATE students SET ${studentColumns} WHERE student_id = ?`,
            [...student.slice(1), student[0]]
        );
        if (result.affectedRows === 0) {
            const [existing] = await db.execute(
                "SELECT student_id FROM students WHERE student_id = ? LIMIT 1",
                [student[0]]
            );
            if (existing.length === 0) return res.status(404).json({ message: "Student not found." });
        }
        return res.json({ message: "Student updated successfully." });
    } catch (error) {
        return handleDatabaseError(res, error, "update");
    }
});

app.delete("/api/students/:id", async (req, res) => {
    try {
        const [result] = await db.execute(
            "DELETE FROM students WHERE student_id = ?",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Student not found." });
        }
        return res.json({ message: "Student deleted successfully." });
    } catch (error) {
        return handleDatabaseError(res, error, "delete");
    }
});

app.use("/api", (req, res) => res.status(404).json({ message: "API route not found." }));

const distDirectory = path.join(__dirname, "dist");
if (isProduction && fs.existsSync(path.join(distDirectory, "index.html"))) {
    app.use(express.static(distDirectory, {
        setHeaders(res, filePath) {
            if (filePath.includes(`${path.sep}assets${path.sep}`)) {
                res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            } else {
                res.setHeader("Cache-Control", "no-cache");
            }
        }
    }));
    app.get("/{*path}", (req, res) => {
        res.setHeader("Cache-Control", "no-cache");
        return res.sendFile(path.join(distDirectory, "index.html"));
    });
} else {
    app.get("/", (req, res) => res.json({ message: "Student Management System API is running." }));
}

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === "entity.too.large") {
        return res.status(413).json({ message: "Request body is too large." });
    }
    if (error instanceof SyntaxError && Object.prototype.hasOwnProperty.call(error, "body")) {
        return res.status(400).json({ message: "Request body must contain valid JSON." });
    }
    console.error("Request failed:", error.message);
    return res.status(500).json({ message: "Unexpected server error." });
});

if (require.main === module) {
    const server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });

    const shutdown = signal => {
        console.log(`${signal} received. Closing server.`);
        server.close(async () => {
            await db.end();
            process.exit(0);
        });
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
}

module.exports = { app, db, readStudent, getStudentFilters, getSortColumn };
