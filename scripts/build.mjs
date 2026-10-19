/**
 * Production build. When a database is configured, the schema is migrated and the admin user is
 * (re)created from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD before `next build`; without one, the
 * public site still builds and runs from the sample content.
 */
import { spawnSync } from "node:child_process";

const run = (cmd) => {
  console.log(`\n> ${cmd}`);
  const r = spawnSync(cmd, { stdio: "inherit", shell: true });
  return r.status === 0;
};

if (process.env.DATABASE_URL) {
  if (!run("prisma migrate deploy")) console.warn("Database migration failed; continuing with the build.");
  else if (!run("prisma db seed")) console.warn("Admin seed failed; continuing with the build.");
} else {
  console.log("DATABASE_URL is not set: skipping migrations and the admin seed.");
}

if (!run("prisma generate")) process.exit(1);
if (!run("next build")) process.exit(1);
