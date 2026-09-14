import type { ReactNode } from "react";
import { config } from "@tenant/config";
import { publishing } from "@tenant/publishing";
import type { Article } from "@/db/schema";
import { getSeriesOptions } from "@/lib/series";
import { ContentPreview } from "./ContentPreview";

export type ArticleFormSlots = { fields?: ReactNode; preview?: ReactNode };

const input =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent";

/**
 * Campos extra del editor de artículos para tenants con `publishing`: serie y
 * parte (feature `series`), número de Apuntes (feature `apuntes`) y la vista
 * previa con el pipeline del tenant.
 *
 * Sin `publishing` (yanina) devuelve `{}`: ArticleForm recibe exactamente las
 * mismas props que antes. Es sincrónica a propósito: si la página tuviera que
 * esperar la consulta de series, cambiaría cómo se transmite el HTML/RSC del
 * editor también en yanina. La consulta la hace ArticlePublishingFields.
 */
export function articleFormSlots(article?: Article): ArticleFormSlots {
  if (!publishing) return {};
  const { series: hasSeries, apuntes: hasIssues } = config.features;
  return {
    ...(hasSeries || hasIssues ? { fields: <ArticlePublishingFields article={article} /> } : {}),
    preview: <ContentPreview labels={publishing.messages.preview} />,
  };
}

async function ArticlePublishingFields({ article }: { article?: Article }) {
  if (!publishing) return null;
  const m = publishing.messages.articleFields;
  const { series: hasSeries, apuntes: hasIssues } = config.features;
  const options = hasSeries ? await getSeriesOptions() : [];

  return (
    <div className="grid gap-5 md:grid-cols-3">
      {hasSeries && (
        <div>
          <label htmlFor="seriesId" className="mb-1 block text-sm font-medium">
            {m.series}
          </label>
          <select id="seriesId" name="seriesId" defaultValue={article?.seriesId ?? ""} className={input}>
            <option value="">{m.noSeries}</option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      )}
      {hasSeries && (
        <div>
          <label htmlFor="seriesOrder" className="mb-1 block text-sm font-medium">
            {`${m.seriesOrder} `}
            <span className="font-normal text-muted">{m.seriesOrderHint}</span>
          </label>
          <input
            id="seriesOrder"
            name="seriesOrder"
            type="number"
            min={1}
            max={999}
            defaultValue={article?.seriesOrder ?? ""}
            className={input}
          />
        </div>
      )}
      {hasIssues && (
        <div>
          <label htmlFor="issueNumber" className="mb-1 block text-sm font-medium">
            {`${m.issueNumber} `}
            <span className="font-normal text-muted">{m.issueNumberHint}</span>
          </label>
          <input
            id="issueNumber"
            name="issueNumber"
            type="number"
            min={1}
            max={9999}
            defaultValue={article?.issueNumber ?? ""}
            className={input}
          />
        </div>
      )}
    </div>
  );
}
