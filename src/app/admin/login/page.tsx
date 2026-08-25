import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Ingresar",
  robots: { index: false, follow: false },
};

export default async function LoginPage(props: PageProps<"/admin/login">) {
  const { next } = await props.searchParams;
  const nextPath = typeof next === "string" ? next : "/admin";

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-sm">
        <h1 className="font-serif text-2xl font-semibold">Panel de administración</h1>
        <p className="mt-1 text-sm text-muted">Ingresá con tus credenciales.</p>
        <LoginForm next={nextPath} />
      </div>
    </div>
  );
}
