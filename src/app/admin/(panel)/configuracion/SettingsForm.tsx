"use client";

import { useActionState, useRef, useState } from "react";
import { saveSettings, type FormState } from "../../actions";
import type { SiteSettings } from "@/lib/settings";

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveSettings,
    undefined,
  );
  const [avatar, setAvatar] = useState(settings.authorAvatar);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadAvatar(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        alert(data.error ?? "No se pudo subir la imagen.");
        return;
      }
      setAvatar(data.url);
    } finally {
      setUploading(false);
    }
  }

  const input =
    "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="authorAvatar" value={avatar} />
      <div>
        <label className="mb-1 block text-sm font-medium">Foto de perfil</label>
        <div className="flex items-center gap-4">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-accent-soft" />
          )}
          <div className="space-y-1">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="rounded-full border border-line bg-white px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {uploading ? "Subiendo…" : avatar ? "Cambiar foto" : "Subir foto"}
            </button>
            {avatar && (
              <button
                type="button"
                onClick={() => setAvatar("")}
                className="ml-3 text-sm text-red-600 hover:text-red-800"
              >
                Quitar
              </button>
            )}
            <p className="text-xs text-muted">También podés pegar una URL abajo.</p>
          </div>
        </div>
        <input
          className={`${input} mt-2`}
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
          placeholder="https://…"
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadAvatar(file);
          }}
        />
      </div>
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
