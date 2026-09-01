export function headingId(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function extractHeadings(content: string): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  for (const line of content.split("\n")) {
    const m = line.match(/^##\s+(.+)$/);
    if (!m) continue;
    const text = m[1].replace(/[*_`]/g, "").trim();
    if (text) out.push({ id: headingId(text), text });
  }
  return out;
}

export function nodeText(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return nodeText((node as { props: { children?: unknown } }).props.children);
  }
  return "";
}
