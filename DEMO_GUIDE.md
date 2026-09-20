# BIIS-2.0 Demonstration Guide

## Prerequisites

- Node.js 20+ recommended
- PostgreSQL running locally
- PowerShell or another terminal
- Two empty databases: `biis_db` and `biis_test`

Do not commit `.env`, passwords, tokens, database dumps, `node_modules`, or build output.

## Database Setup

Create the databases using pgAdmin or PostgreSQL tools:

```sql
CREATE DATABASE biis_db;
CREATE DATABASE biis_test;
```

Copy the server template and replace placeholders locally:

```powershell
Copy-Item server/.env.example server/.env
```

Generate a local access-token secret with Node:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Set that value and local PostgreSQL credentials in `server/.env`. Set all demo password variables there; never put real values in this guide or Git.

## Install and Initialize

```powershell
cd server
npm install
npm run db:init
npm run db:migrate
npm run db:seed
npm run seed:demo
npm run seed:demo
```

Running the seed twice should print readiness both times without creating duplicates.
`db:migrate`, `db:seed`, and `db:init` are non-destructive. They preserve users and academic records.

The destructive command is separate and requires an explicit confirmation:

```powershell
$env:CONFIRM_DB_RESET='YES'
npm run db:reset
```

Never run `db:reset` against production.

Install the client separately:

```powershell
cd ../client
npm install
```

## Start the Application

Terminal 1:

```powershell
cd server
npm run dev
```

Terminal 2:

```powershell
cd client
npm run dev
```

The API health endpoint is `http://localhost:5000/`. The frontend is normally `http://localhost:5173/`.

## Test Commands

Backend tests use a separate test database and must run serially:

```powershell
cd server
$env:DB_NAME='biis_db'
$env:NODE_ENV='test'
$env:TEST_DB_NAME='biis_test'
node --test --test-concurrency=1
```

Client checks:

```powershell
cd client
npm run lint
npm run build
```

API fallback demonstration:

```powershell
cd server
npm run demo:api
```

## Demo Accounts

Configured through environment variables:

- `DEMO_ADMIN_USERNAME`, `DEMO_ADMIN_PASSWORD`
- `DEMO_TEACHER_A_USERNAME`, `DEMO_TEACHER_A_PASSWORD`
- `DEMO_TEACHER_B_USERNAME`, `DEMO_TEACHER_B_PASSWORD`
- `DEMO_STUDENT_A_USERNAME`, `DEMO_STUDENT_A_PASSWORD`
- `DEMO_STUDENT_B_USERNAME`, `DEMO_STUDENT_B_PASSWORD`

## ADMIN Demonstration

1. Open the frontend while logged out.
2. Log in with the configured Admin account.
3. Confirm the Admin dashboard appears.
4. Open User Management.
5. Open Departments and create or list a department.
6. Open Courses and create or list a course.
7. Open Academic Terms and create or list a term.
8. Open Course Offerings and create an offering.
9. Assign Teacher A using the teacher selector.
10. Confirm the success notice and assigned teacher.
11. Try `/dashboard/teacher` and `/dashboard/student`; both must show Unauthorized.
12. Log out.
13. Reuse the old access token through the API demo or test suite; it must receive `401`.

## TEACHER Demonstration

1. Log in as Teacher A.
2. Confirm the Teacher dashboard appears.
3. Confirm Admin and Student dashboard paths are blocked.
4. Open Assigned Offerings.
5. Select Teacher A's offering.
6. View enrolled students.
7. Create an exam with a positive maximum mark.
8. Save valid marks for an enrolled student.
9. Confirm the returned grade is derived by the backend.
10. Submit marks above the maximum and confirm `400` feedback.
11. Leave one saved result unpublished.
12. Publish another result after confirmation.
13. Attempt Teacher B's offering; confirm `403`.
14. Log out.

## STUDENT Demonstration

1. Use the public registration page to create a new Student account.
2. Confirm there is no role selector.
3. Log in as the Student account.
4. Confirm the Student dashboard appears.
5. Confirm Admin and Teacher dashboard paths are blocked.
6. Open Course Registration.
7. Enroll in an available offering.
8. Attempt the same enrollment again and confirm `409` feedback.
9. Confirm My Enrollments shows only that student.
10. Confirm unpublished results are absent.
11. After Teacher publication, refresh Published Results.
12. Confirm course, exam, marks, maximum marks, and grade are shown.
13. Log out and confirm protected requests return `401`.

## Security Demonstrations

- Missing bearer token on `/api/admin/departments`: `401`.
- Student bearer token on `/api/admin/departments`: `403`.
- Student bearer token on `/api/teacher/offerings`: `403`.
- Teacher bearer token on `/api/admin/departments`: `403`.
- Teacher A on Teacher B's offering: `403`.
- Student enrollment body containing `studentId`: `400`.
- Public registration containing `role: ADMIN` or `role: TEACHER`: `400`.
- Access token after logout: `401`.
- Unpublished result: absent from `/api/student/results`.
- Malformed IDs/input: `400`.
- Duplicate resources/enrollments: `409`.
- Missing related records: `404`.

## Evaluator Questions

**Where is authorization enforced?**

In backend middleware and ownership-aware SQL/service checks. Frontend hiding is only usability.

**Can a public user register as Admin or Teacher?**

No. Public registration always obtains the Student role from PostgreSQL and rejects privileged fields.

**How does logout invalidate JWT access?**

The JWT contains a session ID. Middleware requires the matching active database session, and logout revokes it.

**Are refresh tokens stored?**

Only their SHA-256 hashes are stored. Raw refresh tokens stay in HTTP-only cookies.

**How is capacity protected?**

Enrollment locks the offering row in a transaction before counting active registrations.

**How are published results protected?**

The student query includes `published_at IS NOT NULL`; the frontend does not implement the security filter.

## Troubleshooting

- Missing environment variables: compare `server/.env` with `.env.example`.
- Database connection failure: verify PostgreSQL, credentials, port, and database names.
- Test safeguard failure: ensure `TEST_DB_NAME` contains `test` and differs from `DB_NAME`.
- Empty demo lists: rerun `npm run db:init` and `npm run seed:demo` against the development database.
- Port conflict: change `PORT` or Vite's port locally.
- Serial test failures: run `node --test --test-concurrency=1`.
- Mail reset unavailable: password-reset mail variables are optional for academic demonstration.
