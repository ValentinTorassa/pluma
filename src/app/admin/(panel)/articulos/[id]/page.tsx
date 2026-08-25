import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticleById } from "@/lib/data";
import { ArticleForm } from "../ArticleForm";

export const metadata: Metadata = {
  title: "Editar artículo",
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
      <h1 className="mb-6 font-serif text-3xl font-semibold">Editar artículo</h1>
      <ArticleForm article={article} />
    </div>
  );
}
