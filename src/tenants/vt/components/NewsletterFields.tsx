"use client";

import { useState, useTransition } from "react";
import { solveChallenge, type ChallengeToSolve } from "@/lib/altcha-solve";
import type { NewsletterList } from "@/lib/newsletter-lists";
import { signupRefFor } from "../lib/session-ref";
import { copy } from "../messages";

const m = copy.newsletter;

export function NewsletterFields({
  id,
  enabled,
  list,
  submitLabel = m.submit,
  disabledNote = m.disabled,
}: {
  id: string;
  enabled: boolean;
  /** Sin lista es Apuntes; "libro" anota en la lista de espera del libro */
  list?: NewsletterList;
  submitLabel?: string;
  disabledNote?: string;
}) {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    setResult(null);
    startTransition(async () => {
      try {
        // Prueba de trabajo ALTCHA: se pide y se resuelve acá, sin widget ni
        // scripts de terceros. /api/newsletter la verifica antes de reenviar.
        const ch = await fetch("/api/newsletter/challenge", { cache: "no-store" });
        const challenge = (await ch.json()) as ChallengeToSolve & { ok?: boolean; message?: string };
        if (!ch.ok) {
          setResult({ ok: false, text: challenge.message ?? m.error });
          return;
        }
        const altcha = await solveChallenge(challenge);
        if (!altcha) {
          setResult({ ok: false, text: m.error });
          return;
        }
        // De dónde vino (el ?ref= de esta URL o, si no tiene, el del link por
        // el que entró en esta sesión; lo guarda RefMemory) y en qué
        // formulario: se cuentan por día, sin el mail, para saber qué link trae altas.
        const ref = signupRefFor(window.location.search);
        const res = await fetch("/api/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, altcha, ref, form: id, list }),
        });
        const data = (await res.json()) as { ok: boolean; message: string };
        setResult({ ok: data.ok, text: data.message });
        if (data.ok) form.reset();
      } catch {
        setResult({ ok: false, text: m.error });
      }
    });
  }

  return (
    <>
      <form className="nl-form" onSubmit={submit} aria-describedby={enabled ? undefined : `${id}-note`}>
        <label className="vh" htmlFor={id}>
          {m.label}
        </label>
        <input
          className="input"
          id={id}
          name="email"
          type="email"
          placeholder={m.placeholder}
          autoComplete="email"
          required
          maxLength={254}
          disabled={!enabled || pending}
        />
        <button className="btn" type="submit" disabled={!enabled || pending}>
          {pending ? m.sending : submitLabel}
        </button>
      </form>
      {!enabled && (
        <p className="nl-note" id={`${id}-note`}>
          {disabledNote}
        </p>
      )}
      {result && (
        <p className={result.ok ? "ok" : "err"} role="status">
          {result.text}
        </p>
      )}
    </>
  );
}
