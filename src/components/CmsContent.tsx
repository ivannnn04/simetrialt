/** Renders CMS plain-text content: blank lines split paragraphs, "## " lines become headings. */
export function CmsContent({ content }: { content: string }) {
  const blocks = content.split(/\n\s*\n/).filter((b) => b.trim());
  return (
    <div className="space-y-4">
      {blocks.map((block, i) =>
        block.trim().startsWith("## ") ? (
          <h2 key={i} className="text-xl font-semibold tracking-[-0.03em]">
            {block.trim().slice(3)}
          </h2>
        ) : (
          <p key={i} className="whitespace-pre-line leading-relaxed text-label">
            {block.trim()}
          </p>
        )
      )}
    </div>
  );
}
