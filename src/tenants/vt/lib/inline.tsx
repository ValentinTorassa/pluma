import { Fragment, type ReactNode } from "react";

/**
 * Texto plano con `código` entre backticks (bajadas y resúmenes).
 * Solo genera nodos de texto y <code>: nunca interpreta HTML.
 */
export function inlineCode(text: string): ReactNode {
  const pieces = text.split(/`([^`]+)`/);
  if (pieces.length === 1) return text;
  return pieces.map((piece, i) =>
    i % 2 === 1 ? <code key={i}>{piece}</code> : <Fragment key={i}>{piece}</Fragment>,
  );
}

/** Lo mismo pero sin backticks (atributos, metadata, JSON-LD) */
export function plainText(text: string): string {
  return text.replace(/`([^`]+)`/g, "$1");
}
