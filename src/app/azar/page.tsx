import { redirect } from "next/navigation";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function RandomArticlePage() {
  const rows = await db
    .select({ slug: articles.slug })
    .from(articles)
    .where(eq(articles.status, "published"));
  if (rows.length === 0) redirect("/");
  const pick = rows[Math.floor(Math.random() * rows.length)];
  redirect(`/articulo/${pick.slug}`);
}
