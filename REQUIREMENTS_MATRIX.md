# BIIS-2.0 60% Requirements Matrix

Status is based on source inspection plus the serial backend test suite. Browser-only claims remain manual verification items.

| Requirement | Status | Implementation | Test / demonstration | Limitation |
|---|---|---|---|---|
| All-role signup/login | Complete | `server/src/services/auth.service.js`, auth routes, demo seed | `server/test/auth/auth.test.js`; login each seeded role | Teacher/Admin creation is seed/admin-controlled, not public signup |
| Salted password hashing | Complete | `server/src/utils/password.utils.js` using bcrypt | Auth and admin bootstrap tests inspect bcrypt hashes | None |
| Login-state management | Complete | `auth_sessions`, JWT `sid`, refresh rotation | Auth session tests; `npm run demo:api` | Access token remains in React memory only |
| Genuine logout invalidation | Complete | Session revocation and `sid` lookup middleware | Auth logout test and API demo | None |
| Input validation and error codes | Complete | Express validators and service validation | Auth/admin/academic integration tests | Some legacy endpoints have less uniform error wording |
| Database-derived roles | Complete | SQL role joins in auth middleware/services | Auth role tests; role injection tests | None |
| Distinct capability per role | Complete | Role routes and React dashboards | Academic integration tests; role dashboard demo | Browser walkthrough not automated |
| 401 behavior | Complete | `authenticate` middleware | Auth tests and API demo | None |
| 403 behavior | Complete | `authorizeRoles`, ownership services | Academic integration tests and API demo | None |
| Object-level ownership | Complete | Teacher offering joins; student profile joins | Academic integration tests | None |
| Server-side authorization | Complete | Role middleware on every academic route | Academic integration tests | None |
| HTTP/API feature coverage | Complete | Admin, teacher, student academic REST endpoints | `server/test/academic/academic-management.test.js` | No notices/attendance APIs in scope |
| REST methods/status codes | Complete | Route validators/controllers | Academic integration tests cover 200/201/400/403/404/409 | None |
| Parameterized SQL | Complete | Repository queries use `$n` parameters | Source security audit; backend tests | Dynamic SQL is limited to fixed SQL fragments |
| Authentication frontend | Complete | Login/register/context/protected routes | Client build/lint; manual login path documented | Browser smoke test pending |
| Role-aware frontend | Complete | Role dashboard paths and panels | Client build/lint; route guard source review | Browser smoke test pending |
| Feature accessibility through UI | Complete | `RoleAcademicDashboard.jsx` | API-to-screen mapping and build validation | Full UI sequence not browser-tested |
| Error feedback | Complete | Shared notices and backend message rendering | Client source review; build/lint | None |
| No ORM | Complete | `pg` raw SQL repositories | Dependency scan | None |
| No committed secrets | Complete | Ignored `.env`, placeholder `.env.example` | Repository security scan | Local untracked `.env` must remain uncommitted |

## Demonstration Status

- Backend security and ownership behavior: verified by 35 serial tests.
- API smoke script: run against a started server with demo environment values.
- UI browser flow: not verified because no shared browser page was available.
