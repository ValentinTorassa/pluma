import type { Metadata } from "next";
import { Logo } from "@tenant/Logo";
import { messages } from "@tenant/messages";
import { LoginForm } from "./LoginForm";

const m = messages.admin.login;

export const metadata: Metadata = {
  title: m.metaTitle,
  robots: { index: false, follow: false },
};

export default async function LoginPage(props: PageProps<"/admin/login">) {
  const { next } = await props.searchParams;
  const nextPath = typeof next === "string" ? next : "/admin";

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Logo className="h-6 w-6" />
        </div>
        <h1 className="font-serif text-2xl font-semibold">{m.title}</h1>
        <p className="mt-1 text-sm text-muted">{m.subtitle}</p>
        <LoginForm next={nextPath} />
      </div>
    </div>
  );
}
