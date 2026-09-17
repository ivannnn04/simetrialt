"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { slugify } from "@/lib/slug";

const pageSchema = z.object({
  title: z.string().min(1, "Pavadinimas privalomas"),
  slug: z.string().optional(),
  content: z.string().default(""),
  metaTitle: z.string().optional(),
  metaDesc: z.string().optional(),
  published: z.boolean(),
});

export async function savePage(id: string | null, formData: FormData) {
  await requireUser();
  const parsed = pageSchema.parse({
    title: formData.get("title"),
    slug: String(formData.get("slug") ?? ""),
    content: String(formData.get("content") ?? ""),
    metaTitle: String(formData.get("metaTitle") ?? ""),
    metaDesc: String(formData.get("metaDesc") ?? ""),
    published: formData.get("published") === "on",
  });
  const slug = slugify(parsed.slug || parsed.title);
  const data = { ...parsed, slug };
  if (id) {
    await db.page.update({ where: { id }, data });
  } else {
    await db.page.create({ data });
  }
  revalidatePath("/");
  revalidatePath(`/${slug}`);
  redirect("/admin/pages");
}

export async function deletePage(id: string) {
  await requireUser();
  await db.page.delete({ where: { id } });
  revalidatePath("/");
  redirect("/admin/pages");
}
