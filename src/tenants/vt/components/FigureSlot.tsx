import type { ComponentType } from "react";
import { BindScope } from "../figures/BindScope";
import { Chmod } from "../figures/Chmod";
import { GitHistory } from "../figures/GitHistory";
import { MiniBind } from "../figures/MiniBind";
import { MiniGit } from "../figures/MiniGit";
import { MiniChmod } from "../figures/MiniChmod";
import { MiniRotate } from "../figures/MiniRotate";
import { MiniScanner } from "../figures/MiniScanner";
import type { FigureProps } from "../figures/parts";
import { FIGURES, isFigureName, type FigureName } from "../figures/registry";
import { Respawn } from "../figures/Respawn";
import { RotateVsClean } from "../figures/RotateVsClean";
import { ScannerRace } from "../figures/ScannerRace";
import { TermVsKill } from "../figures/TermVsKill";

type Variant = "article" | "inline" | "mini";

/** Nombre registrado → figura interactiva (maqueta v3.1) */
const COMPONENTS: Record<FigureName, ComponentType<FigureProps>> = {
  "git-history": GitHistory,
  "scanner-race": ScannerRace,
  "rotate-vs-clean": RotateVsClean,
  chmod: Chmod,
  "bind-scope": BindScope,
  "term-vs-kill": TermVsKill,
  respawn: Respawn,
};

/** Versiones chicas para "Lo último" del home */
const MINIS: Partial<Record<FigureName, ComponentType<{ label: string }>>> = {
  "git-history": MiniGit,
  chmod: MiniChmod,
  "scanner-race": MiniScanner,
  "rotate-vs-clean": MiniRotate,
  "bind-scope": MiniBind,
};

export function hasMiniFigure(name: string): boolean {
  return isFigureName(name) && Boolean(MINIS[name] && FIGURES[name].mini);
}

/**
 * Lugar de una figura: `article` (en el cuerpo, ancha si la figura lo es),
 * `inline` (dentro de otra columna, p. ej. la serie) o `mini` (home).
 */
export function FigureSlot({
  name,
  caption,
  variant = "article",
}: {
  name: string;
  caption?: string;
  variant?: Variant;
}) {
  if (!isFigureName(name)) return null;
  const figure = FIGURES[name];

  if (variant === "mini") {
    const Mini = MINIS[name];
    return Mini && figure.mini ? <Mini label={figure.mini} /> : null;
  }

  const Figure = COMPONENTS[name];
  return (
    <Figure
      name={name}
      wide={figure.wide && variant === "article"}
      label={figure.label}
      caption={caption ?? figure.caption}
    />
  );
}
