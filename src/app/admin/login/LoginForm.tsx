"use client";

import { useActionState } from "react";
import { login, type FormState } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    login,
    undefined,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="username" className="mb-1 block text-sm font-medium">
          Usuario
        </label>
        <input
          id="username"
          name="username"
          type="text"
          required
          autoComplete="username"
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-50"
      >
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
