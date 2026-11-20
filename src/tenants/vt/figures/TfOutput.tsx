import { Fragment } from "react";

/** Cómo se pinta cada renglón de una salida de Terraform (los símbolos de su diff) */
export type LineKind = "replace" | "del" | "add" | "chg" | "err" | "ok" | "sum" | "plain";

export function lineKind(line: string): LineKind {
  const t = line.trimStart();
  if (t.startsWith("-/+") || line.includes("# forces replacement")) return "replace";
  if (t.startsWith("- ")) return "del";
  if (t.startsWith("+ ")) return "add";
  if (t.startsWith("~ ")) return "chg";
  if (t.startsWith("Error:") || t.startsWith("Planning failed")) return "err";
  if (t.startsWith("No changes.")) return "ok";
  if (t.startsWith("Plan:")) return "sum";
  return "plain";
}

/**
 * Los renglones de prosa («No changes.», «Error: …», «Plan: …») cortan en el
 * celular; los del diff no, para no romper la sangría: ahí el bloque se
 * desliza de costado, como los bloques de código del artículo.
 */
export const wraps = (line: string) => /^[A-Za-z]/.test(line);

/**
 * El comando y lo que imprime, en HTML y no en el dibujo. `id`
 * cambia con el caso: el bloque se vuelve a montar y entra con su fundido,
 * `delay` segundos después (lo que tarda el dibujo en llegar al resultado).
 */
export function TfOutput({
  id,
  kicker,
  prompt,
  command,
  lines,
  delay = 0,
}: {
  id: string;
  kicker: string;
  prompt: string;
  command: string;
  lines: readonly string[];
  delay?: number;
}) {
  return (
    <div className="sb-out">
      <p className="sb-kicker">{kicker}</p>
      <code className="sb-cmd">
        <span aria-hidden="true">{prompt}</span>
        {command.split(" ").map((tok, i) => (
          <Fragment key={i}>
            {i > 0 && " "}
            <span className="sb-tok">{tok}</span>
          </Fragment>
        ))}
      </code>
      <pre key={id} className="sb-pre" style={delay ? { animationDelay: `${delay}s` } : undefined}>
        {lines.map((line, i) => (
          <span key={i} className="sb-ln" data-kind={lineKind(line)} data-wrap={wraps(line) || undefined}>
            {line}
          </span>
        ))}
      </pre>
    </div>
  );
}
