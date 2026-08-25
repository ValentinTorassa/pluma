import Link from "next/link";
import { ArticleCard } from "@/components/ArticleCard";
import {
  getApprovedCommentCounts,
  getPublishedArticles,
  getUpvoteCounts,
} from "@/lib/data";
import { config } from "@/pluma.config";

export const dynamic = "force-dynamic";

export default async function Home(props: PageProps<"/">) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, Number(searchParams.pagina) || 1);

  const { rows, totalPages } = await getPublishedArticles(page);
  const ids = rows.map((a) => a.id);
  const [upvoteCounts, commentCounts] = await Promise.all([
    getUpvoteCounts(ids),
    getApprovedCommentCounts(ids),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <section className="mb-12 border-b border-line pb-10">
        <h1 className="font-serif text-4xl font-semibold tracking-tight">
          {config.author.name}
        </h1>
        <p className="mt-2 text-lg text-accent">{config.author.role}</p>
        <p className="mt-3 max-w-xl text-muted leading-relaxed">
          {config.siteDescription}
        </p>
      </section>

      {rows.length === 0 ? (
        <p className="text-muted">Todavía no hay artículos publicados.</p>
      ) : (
        <section>
          {rows.map((a) => (
            <ArticleCard
              key={a.id}
              article={a}
              upvotes={upvoteCounts.get(a.id) ?? 0}
              commentCount={commentCounts.get(a.id) ?? 0}
            />
          ))}
        </section>
      )}

      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`/?pagina=${page - 1}`} className="text-accent hover:underline">
              ← Más recientes
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`/?pagina=${page + 1}`} className="text-accent hover:underline">
              Más antiguos →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
