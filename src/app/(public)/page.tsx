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
    <div className="mx-auto max-w-3xl animate-fade-up px-6 py-14">
      <section className="relative mb-14">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
          Blog · Santa Fe, Argentina
        </p>
        <h1 className="mt-4 font-serif text-5xl font-semibold leading-[1.05] tracking-tight">
          {config.author.name}
        </h1>
        <p className="mt-3 text-lg italic text-accent">{config.author.role}</p>
        <p className="mt-4 max-w-xl text-muted leading-relaxed">
          {config.siteDescription}
        </p>
        <div
          aria-hidden
          className="mt-10 h-px w-full bg-gradient-to-r from-accent/60 via-line to-transparent"
        />
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
