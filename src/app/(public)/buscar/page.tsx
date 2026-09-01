import type { Metadata } from "next";
import { ArticleCard } from "@/components/ArticleCard";
import { SearchBox } from "@/components/SearchBox";
import { getApprovedCommentCounts, getUpvoteCounts, searchPublished } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buscar",
};

export default async function SearchPage(props: PageProps<"/buscar">) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q : "";
  const rows = query.length >= 2 ? await searchPublished(query) : [];
  const ids = rows.map((a) => a.id);
  const [upvoteCounts, commentCounts] = await Promise.all([
    getUpvoteCounts(ids),
    getApprovedCommentCounts(ids),
  ]);

  return (
    <div className="mx-auto max-w-3xl animate-fade-up px-6 py-14">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Buscar</h1>
      <div className="mt-6">
        <SearchBox defaultValue={query} large />
      </div>

      {query.length > 0 && query.length < 2 && (
        <p className="mt-8 text-muted">Escribí al menos 2 letras.</p>
      )}

      {query.length >= 2 && rows.length === 0 && (
        <p className="mt-8 text-muted">No hay artículos para “{query}”.</p>
      )}

      {rows.length > 0 && (
        <p className="mt-8 text-sm text-muted">
          {rows.length} {rows.length === 1 ? "resultado" : "resultados"}
        </p>
      )}

      <section className="mt-4">
        {rows.map((a) => (
          <ArticleCard
            key={a.id}
            article={a}
            upvotes={upvoteCounts.get(a.id) ?? 0}
            commentCount={commentCounts.get(a.id) ?? 0}
          />
        ))}
      </section>
    </div>
  );
}
