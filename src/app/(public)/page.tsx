import Link from "next/link";
import type { Metadata } from "next";
import { config } from "@tenant/config";
import { messages } from "@tenant/messages";
import { ArticleCard } from "@tenant/slots/ArticleCard";
import { HomeHero } from "@tenant/slots/HomeHero";
import {
  getApprovedCommentCounts,
  getPublishedArticles,
  getUpvoteCounts,
} from "@/lib/data";
import { getSiteSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const m = messages.home;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  return {
    title: {
      absolute: `${config.siteName} — ${site.authorName}`,
    },
    description: site.siteDescription,
  };
}

export default async function Home(props: PageProps<"/">) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, Number(searchParams.pagina) || 1);
  const tag = typeof searchParams.tag === "string" ? searchParams.tag : undefined;

  const [{ rows, totalPages }, site] = await Promise.all([
    getPublishedArticles(page, tag),
    getSiteSettings(),
  ]);
  const pageHref = (n: number) =>
    tag ? `/?tag=${encodeURIComponent(tag)}&pagina=${n}` : `/?pagina=${n}`;
  const ids = rows.map((a) => a.id);
  const [upvoteCounts, commentCounts] = await Promise.all([
    getUpvoteCounts(ids),
    getApprovedCommentCounts(ids),
  ]);

  return (
    <div className="mx-auto max-w-3xl animate-fade-up px-6 py-14">
      <HomeHero site={site} />

      {tag && (
        <p className="mb-8 text-sm text-muted">
          {m.taggedWith}{" "}
          <span className="font-medium text-accent">{tag}</span>
          {" · "}
          <Link href="/" className="link-underline hover:text-ink">
            {m.showAll}
          </Link>
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-muted">{m.empty}</p>
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
            <Link href={pageHref(page - 1)} className="text-accent hover:underline">
              {m.newer}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            {`${m.page} `}{page}{` ${m.of} `}{totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="text-accent hover:underline">
              {m.older}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
