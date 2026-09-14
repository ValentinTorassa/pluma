import type { Metadata } from "next";
import { messages } from "@tenant/messages";
import { getSiteSettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

const m = messages.admin.settings;

export const metadata: Metadata = {
  title: m.title,
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-3xl font-semibold">{m.title}</h1>
      <p className="mt-1 text-sm text-muted">{m.intro}</p>
      <div className="mt-6">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
