import type { ComponentType } from "react";
import { AllowlistEgress } from "../figures/AllowlistEgress";
import { BindScope } from "../figures/BindScope";
import { BlackiceDia } from "../figures/BlackiceDia";
import { BlackiceModos } from "../figures/BlackiceModos";
import { Chmod } from "../figures/Chmod";
import { EgressTripwire } from "../figures/EgressTripwire";
import { EvidenceStack, MiniEvidenceStack } from "../figures/EvidenceStack";
import { GitHistory } from "../figures/GitHistory";
import { GitOpsSignal, MiniGitOpsSignal } from "../figures/GitOpsSignal";
import { GitOpsGates } from "../figures/GitOpsGates";
import { GitOpsRbac } from "../figures/GitOpsRbac";
import { GitOpsDrift } from "../figures/GitOpsDrift";
import { JwtChecks } from "../figures/JwtChecks";
import { JwtFirma } from "../figures/JwtFirma";
import { MiniBind } from "../figures/MiniBind";
import { MiniGit } from "../figures/MiniGit";
import { MiniChmod } from "../figures/MiniChmod";
import { MiniEgress } from "../figures/MiniEgress";
import { MiniRotate } from "../figures/MiniRotate";
import { MiniScanner } from "../figures/MiniScanner";
import { OauthCinco } from "../figures/OauthCinco";
import type { FigureProps } from "../figures/parts";
import { FIGURES, isFigureName, type FigureName } from "../figures/registry";
import { Respawn } from "../figures/Respawn";
import { Request502 } from "../figures/Request502";
import { RequestCapas } from "../figures/RequestCapas";
import { RotateVsClean } from "../figures/RotateVsClean";
import { RoleProof } from "../figures/RoleProof";
import { ScannerRace } from "../figures/ScannerRace";
import { SelfDisable } from "../figures/SelfDisable";
import { TermVsKill } from "../figures/TermVsKill";
import { UfwArreglos } from "../figures/UfwArreglos";
import { UfwCadenas } from "../figures/UfwCadenas";
import { MiniRetry } from "../figures/MiniRetry";
import { WebhookOrder } from "../figures/WebhookOrder";
import { WebhookRace } from "../figures/WebhookRace";
import { WebhookRecon } from "../figures/WebhookRecon";
import { WebhookRetry } from "../figures/WebhookRetry";

type Variant = "article" | "inline" | "mini";

/** Nombre registrado → figura interactiva (maqueta v3.1) */
const COMPONENTS: Record<FigureName, ComponentType<FigureProps>> = {
  "gitops-signal": GitOpsSignal,
  "gitops-gates": GitOpsGates,
  "gitops-rbac": GitOpsRbac,
  "gitops-drift": GitOpsDrift,
  "evidence-stack": EvidenceStack,
  "role-proof": RoleProof,
  "git-history": GitHistory,
  "scanner-race": ScannerRace,
  "rotate-vs-clean": RotateVsClean,
  chmod: Chmod,
  "bind-scope": BindScope,
  "term-vs-kill": TermVsKill,
  respawn: Respawn,
  "webhook-retry": WebhookRetry,
  "webhook-recon": WebhookRecon,
  "webhook-race": WebhookRace,
  "webhook-order": WebhookOrder,
  "allowlist-egress": AllowlistEgress,
  "self-disable": SelfDisable,
  "egress-tripwire": EgressTripwire,
  "jwt-firma": JwtFirma,
  "jwt-checks": JwtChecks,
  "request-capas": RequestCapas,
  "request-502": Request502,
  "ufw-cadenas": UfwCadenas,
  "ufw-arreglos": UfwArreglos,
  "blackice-modos": BlackiceModos,
  "blackice-dia": BlackiceDia,
  "oauth-cinco": OauthCinco,
};

/** Versiones chicas para "Lo último" del home */
const MINIS: Partial<Record<FigureName, ComponentType<{ label: string }>>> = {
  "gitops-signal": MiniGitOpsSignal,
  "evidence-stack": MiniEvidenceStack,
  "git-history": MiniGit,
  chmod: MiniChmod,
  "scanner-race": MiniScanner,
  "rotate-vs-clean": MiniRotate,
  "bind-scope": MiniBind,
  "webhook-retry": MiniRetry,
  "allowlist-egress": MiniEgress,
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
