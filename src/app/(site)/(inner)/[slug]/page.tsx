import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CmsContent } from "@/components/CmsContent";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await db.page.findFirst({ where: { slug, published: true } });
  if (!page) return {};
  return {
    title: page.metaTitle || `${page.title} — Simetria LT`,
    description: page.metaDesc || undefined,
  };
}

export default async function CmsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await db.page.findFirst({ where: { slug, published: true } });
  if (!page) notFound();
  return (
    <article>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">{page.title}</h1>
      <CmsContent content={page.content} />
    </article>
  );
}
