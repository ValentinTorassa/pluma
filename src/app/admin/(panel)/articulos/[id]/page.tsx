import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { messages } from "@tenant/messages";
import { articleFormSlots } from "@/components/admin/ArticlePublishingFields";
import { getArticleById } from "@/lib/data";
import { ArticleForm } from "../ArticleForm";

const m = messages.admin.articles;

export const metadata: Metadata = {
  title: m.editTitle,
  robots: { index: false, follow: false },
};

export default async function EditArticlePage(
  props: PageProps<"/admin/articulos/[id]">,
) {
  const { id } = await props.params;
  const article = await getArticleById(id);
  if (!article) notFound();

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-semibold">{m.editTitle}</h1>
      <ArticleForm article={article} {...articleFormSlots(article)} />
    </div>
  );
}
