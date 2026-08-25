"use client";

import { useRef, useState } from "react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

export function MarkdownEditor({
  name,
  defaultValue = "",
}: {
  name: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function insertAtCursor(before: string, after = "", placeholder = "") {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        alert(data.error ?? "No se pudo subir la imagen.");
        return;
      }
      insertAtCursor(`![${file.name.replace(/\.[^.]+$/, "")}](${data.url})`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const btn =
    "rounded-md border border-line bg-white px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50";

  return (
    <div className="rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <button type="button" className={btn} onClick={() => insertAtCursor("**", "**", "negrita")}>
          <b>B</b>
        </button>
        <button type="button" className={btn} onClick={() => insertAtCursor("*", "*", "cursiva")}>
          <i>I</i>
        </button>
        <button type="button" className={btn} onClick={() => insertAtCursor("\n## ", "", "Título")}>
          H2
        </button>
        <button type="button" className={btn} onClick={() => insertAtCursor("\n### ", "", "Subtítulo")}>
          H3
        </button>
        <button type="button" className={btn} onClick={() => insertAtCursor("[", "](https://)", "texto del link")}>
          Link
        </button>
        <button type="button" className={btn} onClick={() => insertAtCursor("\n> ", "", "Cita")}>
          Cita
        </button>
        <button type="button" className={btn} onClick={() => insertAtCursor("\n- ", "", "Ítem")}>
          Lista
        </button>
        <span className="mx-1 h-4 w-px bg-line" />
        <button
          type="button"
          className={btn}
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? "Subiendo…" : "📷 Imagen"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadImage(file);
          }}
        />
        <span className="mx-1 h-4 w-px bg-line" />
        <button
          type="button"
          className={`${btn} ${preview ? "border-accent text-accent" : ""}`}
          onClick={() => setPreview((p) => !p)}
        >
          {preview ? "✏️ Editar" : "👁 Vista previa"}
        </button>
      </div>

      {preview ? (
        <div className="min-h-96 px-5 py-4">
          {value ? (
            <MarkdownRenderer content={value} />
          ) : (
            <p className="text-sm text-muted">Nada para previsualizar todavía.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={20}
          placeholder="Escribí tu artículo en Markdown…"
          className="min-h-96 w-full resize-y rounded-b-xl bg-white px-5 py-4 font-mono text-sm leading-relaxed outline-none"
        />
      )}
      {/* input espejo para el form cuando está en preview */}
      {preview && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
