import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Simetria LT
        </Link>
        <nav className="flex gap-6 text-sm">
          <Link href="/catalogue" className="hover:underline">Katalogas</Link>
          <Link href="/contact" className="hover:underline">Kontaktai</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-zinc-500">
        © {new Date().getFullYear()} Simetria LT
      </div>
    </footer>
  );
}

/** Renders CMS plain-text content: blank lines split paragraphs, "## " lines become headings. */
export function CmsContent({ content }: { content: string }) {
  const blocks = content.split(/\n\s*\n/).filter((b) => b.trim());
  return (
    <div className="space-y-4">
      {blocks.map((block, i) =>
        block.trim().startsWith("## ") ? (
          <h2 key={i} className="text-xl font-semibold">
            {block.trim().slice(3)}
          </h2>
        ) : (
          <p key={i} className="leading-relaxed text-zinc-700 whitespace-pre-line">
            {block.trim()}
          </p>
        )
      )}
    </div>
  );
}
