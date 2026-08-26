import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getPendingCommentCount } from "@/lib/data";
import { logout } from "../actions";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  if (!(await isAuthenticated())) {
    redirect("/admin/login");
  }

  const pending = await getPendingCommentCount();

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-serif text-xl font-semibold">
              Pluma <span className="text-sm font-normal text-muted">admin</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/admin" className="text-muted transition-colors hover:text-ink">
                Artículos
              </Link>
              <Link
                href="/admin/comentarios"
                className="text-muted transition-colors hover:text-ink"
              >
                Comentarios
                {pending > 0 && (
                  <span className="ml-1.5 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white">
                    {pending}
                  </span>
                )}
              </Link>
              <Link
                href="/admin/configuracion"
                className="text-muted transition-colors hover:text-ink"
              >
                Configuración
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              target="_blank"
              className="text-sm text-muted transition-colors hover:text-ink"
            >
              Ver sitio ↗
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-muted transition-colors hover:text-red-700"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
