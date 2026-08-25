export function TagPill({ tag }: { tag: string }) {
  return (
    <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
      {tag}
    </span>
  );
}
