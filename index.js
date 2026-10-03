/* =========================================================
   STUDENT MANAGEMENT SYSTEM
   Main JavaScript
   ========================================================= */


/* =========================================================
   1. APPLICATION DATA
   ========================================================= */

let students = JSON.parse(
    localStorage.getItem("students")
) || [];

let editingStudentId = null;


/* =========================================================
   2. GET HTML ELEMENTS
   ========================================================= */

const studentForm = document.getElementById("studentForm");

const studentTableBody =
    document.getElementById("studentTableBody");

const totalStudents =
    document.getElementById("totalStudents");

const studentSearch =
    document.getElementById("studentSearch");

const departmentFilter =
    document.getElementById("departmentFilter");

const menuButton =
    document.getElementById("menuButton");

const sidebar =
    document.querySelector(".sidebar");

const navLinks =
    document.querySelectorAll(".nav-link");

const pageSections =
    document.querySelectorAll(".page-section");

const lastUpdated =
    document.getElementById("lastUpdated");


/* =========================================================
   3. START APPLICATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    displayStudents();

    updateDashboard();

    setCurrentDate();

    setupNavigation();

});


/* =========================================================
   4. SHOW DIFFERENT SECTIONS
   ========================================================= */

function showSection(sectionId) {

    pageSections.forEach(section => {

        section.classList.add("hidden");

    });


    const selectedSection =
        document.getElementById(sectionId);


    if (selectedSection) {

        selectedSection.classList.remove("hidden");

    }


    // Update active sidebar link

    navLinks.forEach(link => {

        link.classList.remove("active");

        const href =
            link.getAttribute("href");

        if (href === `#${sectionId}`) {

            link.classList.add("active");

        }

    });


    // Close mobile sidebar

    if (sidebar) {

        sidebar.classList.remove("show");

    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* =========================================================
   5. NAVIGATION
   ========================================================= */

function setupNavigation() {

    navLinks.forEach(link => {

        link.addEventListener("click", event => {

            event.preventDefault();

            const sectionId =
                link.getAttribute("href")
                    .replace("#", "");

            showSection(sectionId);

        });

    });

}


/* =========================================================
   6. MOBILE SIDEBAR
   ========================================================= */

if (menuButton) {

    menuButton.addEventListener("click", () => {

        sidebar.classList.toggle("show");

    });

}


/* =========================================================
   7. REGISTER STUDENT
   ========================================================= */

if (studentForm) {

    studentForm.addEventListener("submit", event => {

        event.preventDefault();


        // Get form values

        const student = {

            id:
                document.getElementById("studentId").value.trim(),

            name:
                document.getElementById("fullName").value.trim(),

            email:
                document.getElementById("email").value.trim(),

            phone:
                document.getElementById("phone").value.trim(),

            dateOfBirth:
                document.getElementById("dateOfBirth").value,

            gender:
                document.getElementById("gender").value,

            department:
                document.getElementById("department").value,

            year:
                document.getElementById("year").value,

            semester:
                document.getElementById("semester").value,

            enrollmentDate:
                document.getElementById("enrollmentDate").value,

            address:
                document.getElementById("address").value.trim(),

            status: "Active"

        };


        /* -----------------------------------------
           CHECK DUPLICATE STUDENT ID
        ----------------------------------------- */

        const duplicate =
            students.some(
                existingStudent =>
                    existingStudent.id === student.id &&
                    existingStudent.id !== editingStudentId
            );


        if (duplicate) {

            alert(
                "A student with this Student ID already exists."
            );

            return;

        }


        /* -----------------------------------------
           EDIT EXISTING STUDENT
        ----------------------------------------- */

        if (editingStudentId) {

            students =
                students.map(existingStudent => {

                    if (
                        existingStudent.id ===
                        editingStudentId
                    ) {

                        return student;

                    }

                    return existingStudent;

                });


            alert("Student updated successfully.");

            editingStudentId = null;

        }


        /* -----------------------------------------
           ADD NEW STUDENT
        ----------------------------------------- */

        else {

            students.push(student);

            alert("Student registered successfully.");

        }


        /* -----------------------------------------
           SAVE DATA
        ----------------------------------------- */

 fetch("http://localhost:5000/api/students", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        id: student.id,
        name: student.name,
        email: student.email,
        phone: student.phone,
        dateOfBirth: student.dateOfBirth,
        gender: student.gender,
        department: student.department,
        year: student.year,
        semester: student.semester,
        enrollmentDate: student.enrollmentDate,
        address: student.address
    })
})
then(response => response.json())
.then(data => {
    console.log(data);

    if (!data.message) {
        throw new Error("Student was not added.");
    }

    alert(data.message);
})
.catch(error => {
    console.error(error);
    alert("Could not connect to backend.");
});
then(response => response.json())
.then(data => {
    console.log(data);
    alert("Student sent to backend successfully!");
})
.catch(error => {
    console.error(error);
    alert("Could not connect to backend.");
});


        /* -----------------------------------------
           UPDATE UI
        ----------------------------------------- */

        displayStudents();

        updateDashboard();


        /* -----------------------------------------
           RESET FORM
        ----------------------------------------- */

        studentForm.reset();


        // Return button text to normal

        const submitButton =
            studentForm.querySelector(
                'button[type="submit"]'
            );

        if (submitButton) {

            submitButton.textContent =
                "Register Student";

        }


        // Go to students page

        showSection("students");

    });

}


/* =========================================================
   8. SAVE STUDENTS TO LOCAL STORAGE
   ========================================================= */

function saveStudents() {

    localStorage.setItem(
        "students",
        JSON.stringify(students)
    );

}


/* =========================================================
   9. DISPLAY STUDENTS
   ========================================================= */

function displayStudents() {

    if (!studentTableBody) {
        return;
    }


    const searchValue =
        studentSearch
            ? studentSearch.value
                .toLowerCase()
                .trim()
            : "";


    const selectedDepartment =
        departmentFilter
            ? departmentFilter.value
            : "";


    /* -----------------------------------------
       FILTER STUDENTS
    ----------------------------------------- */

    const filteredStudents =
        students.filter(student => {

            const matchesSearch =

                student.name
                    .toLowerCase()
                    .includes(searchValue)

                ||

                student.id
                    .toLowerCase()
                    .includes(searchValue)

                ||

                student.email
                    .toLowerCase()
                    .includes(searchValue);


            const matchesDepartment =

                selectedDepartment === ""

                ||

                student.department ===
                selectedDepartment;


            return (
                matchesSearch &&
                matchesDepartment
            );

        });


    /* -----------------------------------------
       EMPTY TABLE
    ----------------------------------------- */

    if (filteredStudents.length === 0) {

        studentTableBody.innerHTML = `

            <tr>

                <td colspan="7">

                    <div class="empty-state">

                        <div class="empty-icon">
                            👨‍🎓
                        </div>

                        <h3>
                            ${
                                students.length === 0
                                    ? "No Students Yet"
                                    : "No Students Found"
                            }
                        </h3>

                        <p>
                            ${
                                students.length === 0
                                    ? "Register your first student to see them here."
                                    : "Try changing your search or department filter."
                            }
                        </p>

                        ${
                            students.length === 0
                            ?
                            `
                            <button
                                class="primary-button"
                                onclick="showSection('registration')"
                            >
                                Register Student
                            </button>
                            `
                            :
                            ""
                        }

                    </div>

                </td>

            </tr>

        `;

        return;

    }


    /* -----------------------------------------
       CREATE TABLE ROWS
    ----------------------------------------- */

    studentTableBody.innerHTML =
        filteredStudents
            .map(student => {

                return `

                    <tr>

                        <td>
                            <strong>
                                ${escapeHTML(student.id)}
                            </strong>
                        </td>

                        <td>
                            <strong>
                                ${escapeHTML(student.name)}
                            </strong>
                        </td>

                        <td>
                            ${escapeHTML(student.email)}
                        </td>

                        <td>
                            ${escapeHTML(student.department)}
                        </td>

                        <td>
                            ${escapeHTML(student.year)}
                        </td>

                        <td>

                            <span
                                class="badge bg-success"
                            >
                                ${escapeHTML(student.status)}
                            </span>

                        </td>

                        <td>

                            <div
                                style="
                                    display:flex;
                                    gap:6px;
                                "
                            >

                                <button
                                    class="btn btn-sm btn-outline-primary"
                                    onclick="editStudent('${escapeHTML(student.id)}')"
                                >
                                    Edit
                                </button>

                                <button
                                    class="btn btn-sm btn-outline-danger"
                                    onclick="deleteStudent('${escapeHTML(student.id)}')"
                                >
                                    Delete
                                </button>

                            </div>

                        </td>

                    </tr>

                `;

            })
            .join("");

}


/* =========================================================
   10. SEARCH STUDENTS
   ========================================================= */

if (studentSearch) {

    studentSearch.addEventListener(
        "input",
        displayStudents
    );

}


/* =========================================================
   11. FILTER BY DEPARTMENT
   ========================================================= */

if (departmentFilter) {

    departmentFilter.addEventListener(
        "change",
        displayStudents
    );

}


/* =========================================================
   12. EDIT STUDENT
   ========================================================= */

function editStudent(studentId) {

    const student =
        students.find(
            student => student.id === studentId
        );


    if (!student) {

        alert("Student not found.");

        return;

    }


    /* -----------------------------------------
       PUT DATA BACK INTO FORM
    ----------------------------------------- */

    document.getElementById("studentId").value =
        student.id;

    document.getElementById("fullName").value =
        student.name;

    document.getElementById("email").value =
        student.email;

    document.getElementById("phone").value =
        student.phone;

    document.getElementById("dateOfBirth").value =
        student.dateOfBirth;

    document.getElementById("gender").value =
        student.gender;

    document.getElementById("department").value =
        student.department;

    document.getElementById("year").value =
        student.year;

    document.getElementById("semester").value =
        student.semester;

    document.getElementById("enrollmentDate").value =
        student.enrollmentDate;

    document.getElementById("address").value =
        student.address;


    /* -----------------------------------------
       REMEMBER WHICH STUDENT IS BEING EDITED
    ----------------------------------------- */

    editingStudentId = student.id;


    /* -----------------------------------------
       CHANGE BUTTON
    ----------------------------------------- */

    const submitButton =
        studentForm.querySelector(
            'button[type="submit"]'
        );

    if (submitButton) {

        submitButton.textContent =
            "Update Student";

    }


    /* -----------------------------------------
       OPEN REGISTRATION PAGE
    ----------------------------------------- */

    showSection("registration");

}


/* =========================================================
   13. DELETE STUDENT
   ========================================================= */

function deleteStudent(studentId) {

    const student =
        students.find(
            student => student.id === studentId
        );


    if (!student) {

        return;

    }


    const confirmed =
        confirm(
            `Are you sure you want to delete ${student.name}?`
        );


    if (!confirmed) {

        return;

    }


    students =
        students.filter(
            student => student.id !== studentId
        );


    saveStudents();

    displayStudents();

    updateDashboard();


    alert("Student deleted successfully.");

}


/* =========================================================
   14. UPDATE DASHBOARD
   ========================================================= */

function updateDashboard() {

    if (totalStudents) {

        totalStudents.textContent =
            students.length;

    }

}


/* =========================================================
   15. CURRENT DATE
   ========================================================= */

function setCurrentDate() {

    if (!lastUpdated) {
        return;
    }


    const today =
        new Date();


    const formattedDate =
        today.toLocaleDateString(
            "en-US",
            {
                year: "numeric",
                month: "short",
                day: "numeric"
            }
        );


    lastUpdated.textContent =
        formattedDate;

}


/* =========================================================
   16. ESCAPE HTML
   Prevents user-entered text from becoming HTML
   ========================================================= */

function escapeHTML(value) {

    if (value === null || value === undefined) {

        return "";

    }


    return String(value)

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");

}


/* =========================================================
   17. MAKE FUNCTIONS AVAILABLE TO HTML
   ========================================================= */

window.showSection = showSection;

window.editStudent = editStudent;

window.deleteStudent = deleteStudent;