import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getIssueByNumber, getIssues } from "@/lib/issues";
import { getSiteSettings } from "@/lib/settings";
import type { TenantPage } from "../../types";
import { renderContent } from "../components/Content";
import { Icon } from "../components/Icon";
import { JsonLd } from "../components/JsonLd";
import { NewsletterForm } from "../components/NewsletterForm";
import { config } from "../config";
import { dayMonth, isoDate, shortDate } from "../lib/dates";
import { articleIcon } from "../lib/icons";
import { inlineCode } from "../lib/inline";
import { alternates, articleMetadata, blogPostingJsonLd } from "../lib/seo";
import { copy } from "../messages";

const m = copy.apuntes;
const FORTNIGHT_MS = 14 * 24 * 60 * 60 * 1000;

const issueLabel = (n: number) => `#${String(n).padStart(2, "0")}`;

/** Fecha estimada del próximo envío (dos semanas después del último), solo si todavía no pasó */
function nextIssueDate(last: Date | null, now = new Date()): Date | null {
  if (!last) return null;
  const next = new Date(last.getTime() + FORTNIGHT_MS);
  return next > now ? next : null;
}

async function ApuntesPage() {
  const issues = await getIssues();
  const next = nextIssueDate(issues[0]?.publishedAt ?? null);

  return (
    <div className="site">
      <div className="col page">
        <p className="eyebrow">{m.eyebrow}</p>
        <h1 className="t-display">{m.title}</h1>
        <p className="lede">{m.lede}</p>
        <ol className="blocks">
          {m.blocks.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ol>

        {config.features.newsletter && (
          <NewsletterForm
            id="nl-q"
            lead={
              <>
                {next && (
                  <b>{`${copy.newsletter.nextIssue}${dayMonth(next)}.`}</b>
                )}
                {copy.newsletter.apuntesLead}
              </>
            }
          />
        )}

        {issues.length === 0 ? (
          <p className="fig-note">{m.empty}</p>
        ) : (
          <ol className="issues" reversed>
            {issues.map((issue) => {
              const date = issue.publishedAt ?? issue.createdAt;
              return (
                <li key={issue.id}>
                  <span className="num">{issueLabel(issue.issueNumber ?? 0)}</span>
                  <Icon name={articleIcon(issue)} />
                  <div>
                    <h2>
                      <Link href={`/apuntes/${issue.issueNumber}`}>{issue.title}</Link>
                    </h2>
                    <time className="tnum" dateTime={isoDate(date)}>
                      {shortDate(date)}
                    </time>
                    {issue.excerpt && <p>{inlineCode(issue.excerpt)}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

export const apuntesPage: TenantPage<Record<string, never>> = {
  Page: ApuntesPage,
  metadata: async () => ({
    title: m.title,
    description: m.metaDescription,
    alternates: alternates("/apuntes"),
  }),
};

function parseNumber(raw: string): number | null {
  return /^\d{1,5}$/.test(raw) ? Number(raw) : null;
}

async function IssuePage({ number }: { number: string }) {
  const n = parseNumber(number);
  const issue = n === null ? null : await getIssueByNumber(n);
  if (!issue || n === null) notFound();

  const [site, content] = await Promise.all([
    getSiteSettings(),
    renderContent(issue.content, { anchors: false }),
  ]);
  const date = issue.publishedAt ?? issue.createdAt;

  return (
    <div className="site">
      <article className="col page">
        <p className="eyebrow">
          <Link href="/apuntes">{m.title}</Link>
          {` · ${issueLabel(n)} · `}
          <time className="tnum" dateTime={isoDate(date)}>
            {shortDate(date)}
          </time>
        </p>
        <h1 className="t-display">{issue.title}</h1>
        {issue.excerpt && <p className="lede">{inlineCode(issue.excerpt)}</p>}
        <div className="issue-body">{content.element}</div>
      </article>
      <JsonLd data={blogPostingJsonLd(issue, site, `/apuntes/${n}`)} />
    </div>
  );
}

export const issuePage: TenantPage<{ number: string }> = {
  Page: IssuePage,
  metadata: async ({ number }): Promise<Metadata> => {
    const n = parseNumber(number);
    if (n === null) return {};
    const [issue, site] = await Promise.all([getIssueByNumber(n), getSiteSettings()]);
    if (!issue) return {};
    return articleMetadata(issue, site, `/apuntes/${n}`);
  },
};
