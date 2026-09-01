import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { headingId, nodeText } from "@/lib/headings";

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div
      className="prose prose-stone max-w-none dark:prose-invert
        prose-headings:font-serif prose-headings:tracking-tight prose-headings:text-ink
        prose-h2:mt-10 prose-h2:scroll-mt-24 prose-h2:border-b prose-h2:border-line prose-h2:pb-2
        prose-p:leading-relaxed
        prose-a:font-medium prose-a:text-accent prose-a:underline-offset-4
        prose-blockquote:border-l-accent prose-blockquote:bg-accent-soft/60
        prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:not-italic
        prose-blockquote:[&>p]:text-ink
        prose-strong:text-ink
        prose-img:rounded-xl prose-img:shadow-md
        prose-li:marker:text-accent"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => {
            const text = nodeText(children);
            return <h2 id={headingId(text)}>{children}</h2>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
