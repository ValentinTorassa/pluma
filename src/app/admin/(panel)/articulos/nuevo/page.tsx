import type { Metadata } from "next";
import { messages } from "@tenant/messages";
import { ArticleForm } from "../ArticleForm";

const m = messages.admin.articles;

export const metadata: Metadata = {
  title: m.newTitle,
  robots: { index: false, follow: false },
};

export default function NewArticlePage() {
  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-semibold">{m.newTitle}</h1>
      <ArticleForm />
    </div>
  );
}
