export function ArticleToc({
  headings,
}: {
  headings: { id: string; text: string }[];
}) {
  if (headings.length < 2) return null;

  return (
    <nav className="no-print mb-10 rounded-2xl border border-line bg-white px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-widest text-muted">En este artículo</p>
      <ol className="mt-3 space-y-2">
        {headings.map((h, i) => (
          <li key={h.id}>
            <a href={`#${h.id}`} className="text-sm text-ink transition-colors hover:text-accent">
              <span className="mr-2 text-muted">{i + 1}.</span>
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
