import type { ReactNode } from "react";

const TAG = /<(key|you|bad|code)>(.*?)<\/\1>/g;

/**
 * Textos de las figuras con marcas mínimas (messages.ts no guarda HTML):
 * <key>.env</key>, <you>HEAD</you>, <bad>…</bad> (resultado en rojo), <code>…</code>.
 */
export function rich(text: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TAG)) {
    const [whole, tag, inner] = match;
    if (match.index > last) out.push(text.slice(last, match.index));
    const key = match.index;
    if (tag === "key") out.push(<b key={key} className="c-key fig-em">{inner}</b>);
    else if (tag === "you") out.push(<span key={key} className="c-you fig-em">{inner}</span>);
    else if (tag === "bad") out.push(<b key={key} className="fig-bad">{inner}</b>);
    else out.push(<code key={key}>{inner}</code>);
    last = match.index + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
