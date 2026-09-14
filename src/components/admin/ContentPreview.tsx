"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { previewContent } from "@/app/admin/actions";
import type { PublishingMessages } from "@/tenants/types";

/**
 * Vista previa del contenido con el pipeline del tenant (server action): se ve
 * igual que en el sitio, figuras interactivas incluidas. Lee el campo `content`
 * del formulario que la contiene, así que funciona tanto en modo edición como
 * con la vista previa simple del editor abierta.
 */
export function ContentPreview({ labels }: { labels: PublishingMessages["preview"] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<ReactNode>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function render() {
    const form = ref.current?.closest("form");
    const content = form ? String(new FormData(form).get("content") ?? "").trim() : "";
    setFailed(false);
    if (!content) {
      setResult(<p className="text-sm text-muted">{labels.empty}</p>);
      return;
    }
    startTransition(async () => {
      try {
        const element = await previewContent(content);
        startTransition(() => setResult(element));
      } catch {
        setFailed(true);
      }
    });
  }

  const btn =
    "rounded-md border border-line bg-white px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50";

  return (
    <div ref={ref} className="rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <p className="text-sm">
          <span className="font-medium">{labels.title}</span>
          <span className="text-muted">{` · ${labels.hint}`}</span>
        </p>
        <button type="button" className={btn} disabled={pending} onClick={render}>
          {pending ? labels.rendering : labels.render}
        </button>
      </div>
      {(failed || result) && (
        <div className="max-h-[40rem] overflow-y-auto px-5 py-4" aria-busy={pending}>
          {failed ? <p className="text-sm text-red-700">{labels.failed}</p> : result}
        </div>
      )}
    </div>
  );
}
