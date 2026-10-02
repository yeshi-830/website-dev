const express = require("express");

const app = express();

const PORT = 5000;

app.use(express.json());

// Home route
app.get("/", (req, res) => {
    res.send("Student Management System Backend is Running!");
});

// Get students
app.get("/api/students", (req, res) => {
    res.json([
        {
            id: 1,
            name: "Abebe Kebede",
            department: "Software Engineering"
        },
        {
            id: 2,
            name: "Sara Ahmed",
            department: "Computer Science"
        }
    ]);
});

// Add a new student
app.post("/api/students", (req, res) => {
    const { name, department } = req.body;

    const newStudent = {
        id: Date.now(),
        name: name,
        department: department
    };

    res.json({
        message: "Student added successfully",
        student: newStudent
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});