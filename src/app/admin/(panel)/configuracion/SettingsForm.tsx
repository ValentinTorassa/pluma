"use client";

import { useActionState } from "react";
import { saveSettings, type FormState } from "../../actions";
import type { SiteSettings } from "@/lib/settings";

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveSettings,
    undefined,
  );

  const input =
    "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium">Nombre</label>
        <input name="authorName" required defaultValue={settings.authorName} className={input} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">
          Rol / título <span className="font-normal text-muted">(ej: Lic. en Psicología · …)</span>
        </label>
        <input name="authorRole" required defaultValue={settings.authorRole} className={input} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">
          Descripción corta <span className="font-normal text-muted">(home y SEO)</span>
        </label>
        <textarea
          name="siteDescription"
          required
          rows={2}
          defaultValue={settings.siteDescription}
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">
          Bio <span className="font-normal text-muted">(página Acerca de)</span>
        </label>
        <textarea name="authorBio" required rows={6} defaultValue={settings.authorBio} className={input} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input name="authorEmail" type="email" defaultValue={settings.authorEmail} className={input} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">LinkedIn (URL)</label>
          <input name="authorLinkedin" type="url" defaultValue={settings.authorLinkedin} className={input} />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.saved && <p className="text-sm text-green-700">¡Guardado! Ya está visible en el sitio.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
