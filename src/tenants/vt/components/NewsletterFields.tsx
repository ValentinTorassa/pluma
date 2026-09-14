"use client";

import { useState, useTransition } from "react";
import { copy } from "../messages";

const m = copy.newsletter;

export function NewsletterFields({ id, enabled }: { id: string; enabled: boolean }) {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
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
        {/*
          ALTCHA (pendiente, con listmonk): acá va el widget self-hosted
          <altcha-widget challengeurl="/api/newsletter/challenge" />, sin
          scripts de terceros. Su payload viaja en el body como `altcha` y lo
          verifica /api/newsletter antes de reenviar.
        */}
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
          {pending ? m.sending : m.submit}
        </button>
      </form>
      {!enabled && (
        <p className="nl-note" id={`${id}-note`}>
          {m.disabled}
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
