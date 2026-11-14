# EduManage Student Administration

EduManage is a responsive student administration application. The React and Vite interface uses an Express API and MySQL for administrator sign-in, student registration and editing, searchable and paginated records, enrollment analytics, and CSV reports.

## Requirements

- Node.js 22.12 or newer
- MySQL 8 or newer
- npm

## Local setup

1. Copy `.env.example` to `.env` and set a unique database password, administrator password (at least 12 characters), and a random session secret (at least 32 characters). Keep `.env` private and out of source control.

   Generate a session secret with:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   ```

2. Create the database configured by `DB_NAME` and apply the schema:

   ```sh
   mysql -u root -p -e "CREATE DATABASE edumanage CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
   mysql -u root -p edumanage < database/schema.sql
   ```

   Use the database name from `.env` if it differs from `edumanage`. Existing installations should apply `database/migrations/001_student_list_indexes.sql` once to add indexes for department/year filters and recent-registration queries.

3. Install dependencies and start both development processes:

   ```sh
   npm ci
   npm run server
   ```

   In another terminal, run:

   ```sh
   npm run dev
   ```

   Open the Vite URL (usually `http://localhost:5173`). Vite proxies `/api` requests to the Express server on port 5000. Add any additional development frontend origins to `CORS_ORIGIN`, separated by commas.

## Production deployment

The Express server serves the built frontend and API from one origin. Configure `NODE_ENV=production`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and a cryptographically random `SESSION_SECRET` of at least 32 characters before starting; the server will refuse production startup without them. Keep database and admin credentials in your deployment's secret manager.

```sh
npm ci
npm run build
npm start
```

The application listens on `PORT` (5000 by default). `/api/health` reports database readiness. Put a TLS-enabled reverse proxy in front of the service and expose only HTTPS to users.

### Docker Compose

Copy `.env.example` to `.env`, replace every example password and secret with unique values, then start the application and MySQL:

```sh
docker compose up --build -d
```

The frontend/API is published on port 5000 by default; set `PORT` in `.env` to change the host port. MySQL remains on the internal Compose network, and its data persists in the `mysql_data` volume. The schema is applied automatically only when that volume is initialized for the first time.

## Authentication and security

- The single administrator account is configured with environment secrets; there are no default production credentials or public registration route.
- Sign-in issues an eight-hour HMAC-signed, `HttpOnly`, `SameSite=Lax` session cookie. Production cookies are marked `Secure`.
- Student and dashboard APIs require a valid session. Login attempts are rate-limited, request bodies have a size limit, and browser origins are restricted to the same host and configured `CORS_ORIGIN` values.
- Student fields are validated on the server and SQL values are parameterized. CSV exports escape spreadsheet formula prefixes.
- The Compose setup keeps MySQL off the host network. For standalone deployments, restrict database network access and terminate TLS at a trusted proxy.

## Application features

- Dashboard totals, monthly registration chart, department breakdown, recent records, and database connection status are derived from MySQL data.
- Student search covers name, student ID, email, and phone. Department, year, status, sorting, and server-side pagination are supported.
- Student registration, editing, and deletion operate on the MySQL student register.
- CSV exports can include the full register or the current directory filters.
- Courses, attendance, and grades are intentionally shown as unconfigured until a persistent data model exists; sample content is not presented as live data.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/auth/session` | Check administrator session |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | Sign out |
| `GET` | `/api/health` | Check API and database readiness |
| `GET` | `/api/dashboard` | Read live dashboard metrics |
| `GET` | `/api/students` | List students; accepts `q`, `department`, `year`, `status`, `sort`, `page`, and `limit` |
| `POST` | `/api/students` | Register a student |
| `PUT` | `/api/students/:id` | Update a student |
| `DELETE` | `/api/students/:id` | Delete a student |
| `GET` | `/api/students/export.csv` | Export student records as CSV |

`GET /api/students` without query parameters retains the legacy array response. Paginated requests return `{ items, total, page, pageSize, totalPages }`.

## Verification

Run the unit and authentication tests and build the production bundle:

```sh
npm test
npm run build
```
