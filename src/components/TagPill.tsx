import Link from "next/link";

export function TagPill({ tag }: { tag: string }) {
  return (
    <Link
      href={`/?tag=${encodeURIComponent(tag)}`}
      className="rounded-full border border-accent/15 bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-white"
    >
      {tag}
    </Link>
  );
}
