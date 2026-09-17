import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

/** Saves an uploaded image under public/uploads and returns its public URL path. */
export async function saveImage(file: File): Promise<string> {
  if (!ALLOWED.has(file.type)) {
    throw new Error(`Nepalaikomas failo tipas: ${file.type || "nežinomas"}`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Failas per didelis (maks. 8 MB)");
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}${EXT[file.type]}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, name), buffer);
  return `/uploads/${name}`;
}
