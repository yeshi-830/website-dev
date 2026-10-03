const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true
});

app.get("/", (req, res) => {
    res.json({ message: "Student Management System API is running." });
});

app.get("/api/health", async (req, res) => {
    try {
        await db.query("SELECT 1");
        res.json({ api: "ok", database: "connected" });
    } catch (error) {
        console.error("Database health check failed:", error.message);
        res.status(503).json({ api: "ok", database: "unavailable" });
    }
});

app.get("/api/students", async (req, res) => {
    try {
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
        res.json(students);
    } catch (error) {
        console.error("Failed to load students:", error.message);
        res.status(500).json({ message: "Failed to load students." });
    }
});

function readStudent(body) {
    const {
        id,
        name,
        email,
        phone,
        dateOfBirth,
        gender,
        department,
        year,
        semester,
        enrollmentDate,
        address
    } = body;

    if (![id, name, email, department, year].every(value => typeof value === "string" && value.trim())) {
        return null;
    }

    return [
        id.trim(),
        name.trim(),
        email.trim(),
        phone || null,
        dateOfBirth || null,
        gender || null,
        department.trim(),
        year.trim(),
        semester || null,
        enrollmentDate || null,
        address || null
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
        return res.status(400).json({ message: "Student ID, name, email, department, and year are required." });
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
        res.status(201).json({ message: "Student registered successfully." });
    } catch (error) {
        handleDatabaseError(res, error, "register");
    }
});

app.put("/api/students/:id", async (req, res) => {
    const student = readStudent({ ...req.body, id: req.params.id });
    if (!student) {
        return res.status(400).json({ message: "Name, email, department, and year are required." });
    }

    try {
        const [result] = await db.execute(
            `UPDATE students SET ${studentColumns} WHERE student_id = ?`,
            [...student.slice(1), student[0]]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Student not found." });
        }
        res.json({ message: "Student updated successfully." });
    } catch (error) {
        handleDatabaseError(res, error, "update");
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
        res.json({ message: "Student deleted successfully." });
    } catch (error) {
        handleDatabaseError(res, error, "delete");
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});