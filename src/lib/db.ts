import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; dbDownUntil?: number };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

const TIMEOUT_MS = 1500;

export type DbStatus = { ok: boolean; error?: string };

/** First meaningful line of an error (Prisma messages start with blank lines and the invocation). */
export function firstLine(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("Invalid `"));
  return lines[0] ?? text;
}

/** Connectivity check for the admin: resolves instead of throwing when the database is not configured. */
export async function dbStatus(timeoutMs = 8000): Promise<DbStatus> {
  if (!process.env.DATABASE_URL) return { ok: false, error: "DATABASE_URL nenustatytas" };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`nepavyko prisijungti per ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: firstLine(e) };
  } finally {
    clearTimeout(timer);
  }
}
const RETRY_AFTER_MS = 60_000;

/**
 * Runs a read against the database for the public site, which must keep working from the
 * sample data while no client database is reachable. The call is capped at 1.5s and, after a
 * failure, the database is skipped for a minute so that every page render and filter change does
 * not wait for a connection timeout.
 */
export async function tryDb<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  if (Date.now() < (globalForPrisma.dbDownUntil ?? 0)) return undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`database timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS);
      }),
    ]);
  } catch (e) {
    globalForPrisma.dbDownUntil = Date.now() + RETRY_AFTER_MS;
    console.error(`${label}: database unavailable`, e instanceof Error ? e.message : e);
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
