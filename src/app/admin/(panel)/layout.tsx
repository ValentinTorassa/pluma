import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@tenant/Logo";
import { messages } from "@tenant/messages";
import { isAuthenticated } from "@/lib/auth";
import { getPendingCommentCount } from "@/lib/data";
import { logout } from "../actions";

const a = messages.admin;

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
            <Link href="/admin" className="group flex items-center gap-2 font-serif text-xl font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-paper text-accent transition-transform duration-300 group-hover:-rotate-12">
                <Logo className="h-4.5 w-4.5" />
              </span>
              {`${a.brand} `}<span className="text-sm font-normal text-muted">{a.brandSuffix}</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/admin" className="text-muted transition-colors hover:text-ink">
                {a.nav.articles}
              </Link>
              <Link
                href="/admin/comentarios"
                className="text-muted transition-colors hover:text-ink"
              >
                {a.nav.comments}
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
                {a.nav.settings}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              target="_blank"
              className="text-sm text-muted transition-colors hover:text-ink"
            >
              {a.nav.viewSite}
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-muted transition-colors hover:text-red-700"
              >
                {a.nav.logout}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
