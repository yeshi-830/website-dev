process.env.NODE_ENV = "test";
process.env.ADMIN_USERNAME = "test-administrator";
process.env.ADMIN_PASSWORD = "test-password-with-enough-length";
process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";

const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const { app, db, readStudent, getStudentFilters, getSortColumn } = require("../server");

test("student input is trimmed and optional blank fields are normalized", () => {
    const result = readStudent({
        id: " STU-1 ",
        name: " Ada Student ",
        email: " ada@example.edu ",
        department: " Computer Science ",
        year: " 1st Year ",
        phone: "",
        dateOfBirth: "2004-02-29"
    });

    assert.deepEqual(result, [
        "STU-1", "Ada Student", "ada@example.edu", null, "2004-02-29",
        null, "Computer Science", "1st Year", null, null, null
    ]);
});

test("student input rejects malformed required values, dates, and field lengths", () => {
    const valid = {
        id: "STU-1",
        name: "Ada Student",
        email: "ada@example.edu",
        department: "Computer Science",
        year: "1st Year"
    };

    assert.equal(readStudent(null), null);
    assert.equal(readStudent({ ...valid, email: "not-an-email" }), null);
    assert.equal(readStudent({ ...valid, dateOfBirth: "2025-02-29" }), null);
    assert.equal(readStudent({ ...valid, name: "x".repeat(161) }), null);
    assert.equal(readStudent({ ...valid, address: 24 }), null);
});

test("student filters keep user input in bound parameters and sort keys are allowlisted", () => {
    const filters = getStudentFilters({
        q: "' OR 1=1 --",
        department: "Computer Science",
        year: "1st Year",
        status: "Active"
    });

    assert.match(filters.sql, /student_id LIKE \?/);
    assert.doesNotMatch(filters.sql, /OR 1=1/);
    assert.deepEqual(filters.values, [
        "%' OR 1=1 --%", "%' OR 1=1 --%", "%' OR 1=1 --%", "%' OR 1=1 --%",
        "Computer Science", "1st Year", "Active"
    ]);
    assert.equal(getSortColumn("newest"), "created_at DESC, student_id DESC");
    assert.equal(getSortColumn("name; DROP TABLE students"), "name, student_id");
});

test("administrator APIs require a session and support login and logout", async t => {
    const server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    t.after(async () => {
        await new Promise(resolve => {
            server.close(resolve);
            server.closeAllConnections();
        });
        await db.end();
    });

    const unauthenticated = await fetch(`${baseUrl}/api/students?page=1`);
    assert.equal(unauthenticated.status, 401);

    const rejectedOrigin = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Origin: "https://untrusted.example" }
    });
    assert.equal(rejectedOrigin.status, 403);

    const invalidLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "test-administrator", password: "incorrect-password" })
    });
    assert.equal(invalidLogin.status, 401);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "test-administrator", password: "test-password-with-enough-length" })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];

    const authenticated = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Cookie: cookie }
    });
    assert.deepEqual(await authenticated.json(), {
        authenticated: true,
        authRequired: true,
        username: "test-administrator"
    });

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
        headers: { Cookie: cookie }
    });
    assert.equal(logout.status, 200);

    const afterLogout = await fetch(`${baseUrl}/api/auth/session`);
    assert.equal((await afterLogout.json()).authenticated, false);
});
