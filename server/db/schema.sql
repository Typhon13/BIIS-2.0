DROP TABLE IF EXISTS "User" CASCADE;
DROP TABLE IF EXISTS "Role" CASCADE;

CREATE TABLE "Role" (
    "RoleID" SERIAL PRIMARY KEY,
    "RoleName" VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE "User" (
    "UserID" SERIAL PRIMARY KEY,
    "Username" VARCHAR(50) NOT NULL UNIQUE,
    "PasswordHash" VARCHAR(255) NOT NULL,
    "Email" VARCHAR(100) NOT NULL UNIQUE,
    "RoleID" INT REFERENCES "Role"("RoleID"),
    "LastLoginAt" TIMESTAMP,
    "AccountStatus" VARCHAR(20) DEFAULT 'ACTIVE'
);

--ask later what create index is

CREATE INDEX idx_user_role ON "User"("RoleID");
CREATE INDEX idx_user_email ON "User"("Email");