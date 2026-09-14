"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { messages } from "@tenant/messages";
import { saveArticle, type FormState } from "../../actions";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import type { Article } from "@/db/schema";
import { IMAGE_ACCEPT } from "@/lib/image-type";
import { parseTags } from "@/lib/tags";

const f = messages.admin.form;

/**
 * `fields` y `preview` los arma el server con articleFormSlots() solo para
 * tenants con `publishing` (serie, número de Apuntes, vista previa). Sin ellos
 * el formulario es el de siempre.
 */
export function ArticleForm({
  article,
  fields,
  preview,
}: {
  article?: Article;
  fields?: ReactNode;
  preview?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveArticle,
    undefined,
  );
  const [coverImage, setCoverImage] = useState(article?.coverImage ?? "");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadCover(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        alert(data.error ?? f.uploadFailed);
        return;
      }
      setCoverImage(data.url);
    } finally {
      setUploading(false);
    }
  }

  const input =
    "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={article?.id ?? ""} />
      <input type="hidden" name="coverImage" value={coverImage} />

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">{f.title}</label>
          <input
            name="title"
            required
            defaultValue={article?.title}
            placeholder={f.titlePlaceholder}
            className={input}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            {`${f.slug} `}<span className="font-normal text-muted">{f.slugHint}</span>
          </label>
          <input
            name="slug"
            defaultValue={article?.slug}
            placeholder={f.slugPlaceholder}
            className={input}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          {f.excerpt}{" "}
          <span className="font-normal text-muted">{f.excerptHint}</span>
        </label>
        <input
          name="excerpt"
          defaultValue={article?.excerpt}
          placeholder={f.excerptPlaceholder}
          className={input}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">
            {`${f.tags} `}<span className="font-normal text-muted">{f.tagsHint}</span>
          </label>
          <input
            name="tags"
            defaultValue={article ? parseTags(article).join(", ") : ""}
            placeholder={f.tagsPlaceholder}
            className={input}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{f.cover}</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="rounded-full border border-line bg-white px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {uploading ? f.uploading : coverImage ? f.changeImage : f.uploadImage}
            </button>
            {coverImage && (
              <button
                type="button"
                onClick={() => setCoverImage("")}
                className="text-sm text-red-600 hover:text-red-800"
              >
                {f.remove}
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadCover(file);
            }}
          />
        </div>
      </div>

      {coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverImage}
          alt={f.coverAlt}
          className="aspect-[3/1] w-full rounded-xl object-cover"
        />
      )}

      {fields}

      <div>
        <label className="mb-1 block text-sm font-medium">{f.content}</label>
        <MarkdownEditor name="content" defaultValue={article?.content ?? ""} />
      </div>

      {preview}

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}

      <div className="flex items-center gap-3 border-t border-line pt-5">
        <button
          type="submit"
          name="status"
          value="draft"
          disabled={pending}
          className="rounded-full border border-line bg-white px-6 py-2.5 text-sm font-medium transition-colors hover:border-ink disabled:opacity-50"
        >
          {f.saveDraft}
        </button>
        <button
          type="submit"
          name="status"
          value="published"
          disabled={pending}
          className="rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-50"
        >
          {article?.status === "published" ? f.keepPublished : f.publish}
        </button>
      </div>
    </form>
  );
}
