"use client";

import { useActionState } from "react";
import { saveSeries, type FormState } from "@/app/admin/actions";
import type { Series } from "@/db/schema";
import type { PublishingMessages } from "@/tenants/types";

/** Alta y edición de una serie (feature `series`). Los textos llegan del server (`publishing.messages`). */
export function SeriesForm({
  series,
  labels,
}: {
  series?: Series;
  labels: PublishingMessages["seriesForm"];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveSeries, undefined);

  const input =
    "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={series?.id ?? ""} />

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium">
            {labels.title}
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue={series?.title}
            placeholder={labels.titlePlaceholder}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="slug" className="mb-1 block text-sm font-medium">
            {`${labels.slug} `}
            <span className="font-normal text-muted">{labels.slugHint}</span>
          </label>
          <input
            id="slug"
            name="slug"
            defaultValue={series?.slug}
            placeholder={labels.slugPlaceholder}
            className={input}
          />
        </div>
      </div>

      <div>
        <label htmlFor="summary" className="mb-1 block text-sm font-medium">
          {`${labels.summary} `}
          <span className="font-normal text-muted">{labels.summaryHint}</span>
        </label>
        <input id="summary" name="summary" defaultValue={series?.summary} className={input} />
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium">
          {`${labels.description} `}
          <span className="font-normal text-muted">{labels.descriptionHint}</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={series?.description}
          className={input}
        />
      </div>

      <div className="max-w-xs">
        <label htmlFor="plannedParts" className="mb-1 block text-sm font-medium">
          {`${labels.plannedParts} `}
          <span className="font-normal text-muted">{labels.plannedPartsHint}</span>
        </label>
        <input
          id="plannedParts"
          name="plannedParts"
          type="number"
          min={1}
          max={99}
          defaultValue={series?.plannedParts ?? ""}
          className={input}
        />
      </div>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}

      <div className="flex items-center gap-3 border-t border-line pt-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-50"
        >
          {pending ? labels.saving : labels.save}
        </button>
      </div>
    </form>
  );
}
