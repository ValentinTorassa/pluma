import type { Metadata } from "next";
import { ArticleForm } from "../ArticleForm";

export const metadata: Metadata = {
  title: "Nuevo artículo",
  robots: { index: false, follow: false },
};

export default function NewArticlePage() {
  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-semibold">Nuevo artículo</h1>
      <ArticleForm />
    </div>
  );
}
